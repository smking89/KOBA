import { CommunityRole } from '../accounts/community-role.types';
import {
  CannotAssignOwnerRoleError,
  CannotAssignRoleAboveOwnRankError,
  CannotModifyOwnerRoleError,
  InsufficientGroupRoleError,
  NotGroupMemberError,
  PrivateGroupJoinRequiresInviteError,
} from './group.errors';
import { GroupMembershipService } from './group-membership.service';
import { InMemoryGroupMembershipRepository } from './in-memory-group-membership.repository';
import { InMemoryGroupRepository } from './in-memory-group.repository';
import { GroupService } from './group.service';

describe('GroupMembershipService', () => {
  let groupRepository: InMemoryGroupRepository;
  let membershipRepository: InMemoryGroupMembershipRepository;
  let groupService: GroupService;
  let service: GroupMembershipService;

  const OWNER = 'KOBA-PL-AAAA';
  const ADMIN = 'KOBA-PL-ADMN';
  const MODERATOR = 'KOBA-PL-MDRT';
  const MEMBER = 'KOBA-PL-MEMB';
  const OUTSIDER = 'KOBA-PL-ZZZZ';

  beforeEach(() => {
    groupRepository = new InMemoryGroupRepository();
    membershipRepository = new InMemoryGroupMembershipRepository();
    groupService = new GroupService(groupRepository, membershipRepository);
    service = new GroupMembershipService(membershipRepository, groupService);
  });

  async function seedRoles(groupId: string) {
    await membershipRepository.save({ groupId, memberKobaId: ADMIN, role: CommunityRole.ADMIN, joinedAt: new Date() });
    await membershipRepository.save({
      groupId,
      memberKobaId: MODERATOR,
      role: CommunityRole.MODERATOR,
      joinedAt: new Date(),
    });
    await membershipRepository.save({ groupId, memberKobaId: MEMBER, role: CommunityRole.MEMBER, joinedAt: new Date() });
  }

  describe('join (public group)', () => {
    it('is open — any KobaId can join a public group as a member', async () => {
      const group = await groupService.createGroup({ name: 'Open Group', visibility: 'public', ownerKobaId: OWNER });

      const membership = await service.join(group.id, OUTSIDER);
      expect(membership.role).toBe(CommunityRole.MEMBER);
      expect(await service.isMember(group.id, OUTSIDER)).toBe(true);
    });

    it('is idempotent — joining twice returns the existing membership', async () => {
      const group = await groupService.createGroup({ name: 'Open Group', visibility: 'public', ownerKobaId: OWNER });

      const first = await service.join(group.id, OUTSIDER);
      const second = await service.join(group.id, OUTSIDER);
      expect(second.joinedAt).toEqual(first.joinedAt);

      const members = await service.listMembers(group.id);
      expect(members.filter((m) => m.memberKobaId === OUTSIDER)).toHaveLength(1);
    });
  });

  describe('join (private group)', () => {
    it('cannot be self-joined', async () => {
      const group = await groupService.createGroup({
        name: 'Secret Group',
        visibility: 'private',
        ownerKobaId: OWNER,
      });

      await expect(service.join(group.id, OUTSIDER)).rejects.toThrow(PrivateGroupJoinRequiresInviteError);
    });
  });

  describe('addMember', () => {
    it('lets the owner/admin add a member to a private group directly', async () => {
      const group = await groupService.createGroup({
        name: 'Secret Group',
        visibility: 'private',
        ownerKobaId: OWNER,
      });

      const membership = await service.addMember(group.id, OWNER, OUTSIDER);
      expect(membership.role).toBe(CommunityRole.MEMBER);
      expect(await service.isMember(group.id, OUTSIDER)).toBe(true);
    });

    it('rejects a non-owner/admin caller', async () => {
      const group = await groupService.createGroup({
        name: 'Secret Group',
        visibility: 'private',
        ownerKobaId: OWNER,
      });
      await seedRoles(group.id);

      await expect(service.addMember(group.id, MEMBER, OUTSIDER)).rejects.toThrow(InsufficientGroupRoleError);
      await expect(service.addMember(group.id, MODERATOR, OUTSIDER)).rejects.toThrow(InsufficientGroupRoleError);
    });

    it('rejects assigning the owner role via addMember', async () => {
      const group = await groupService.createGroup({
        name: 'Secret Group',
        visibility: 'private',
        ownerKobaId: OWNER,
      });

      await expect(service.addMember(group.id, OWNER, OUTSIDER, CommunityRole.OWNER)).rejects.toThrow(
        CannotAssignOwnerRoleError,
      );
    });

    it('is idempotent — adding an already-existing member returns their current membership', async () => {
      const group = await groupService.createGroup({
        name: 'Secret Group',
        visibility: 'private',
        ownerKobaId: OWNER,
      });
      await seedRoles(group.id);

      const result = await service.addMember(group.id, OWNER, MEMBER, CommunityRole.ADMIN);
      expect(result.role).toBe(CommunityRole.MEMBER);
    });
  });

  describe('setRole', () => {
    it('lets the owner promote a member to moderator', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      const updated = await service.setRole(group.id, OWNER, MEMBER, CommunityRole.MODERATOR);
      expect(updated.role).toBe(CommunityRole.MODERATOR);
    });

    it('lets an admin demote a moderator to member', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      const updated = await service.setRole(group.id, ADMIN, MODERATOR, CommunityRole.MEMBER);
      expect(updated.role).toBe(CommunityRole.MEMBER);
    });

    it('rejects a caller who is not owner/admin', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      await expect(service.setRole(group.id, MODERATOR, MEMBER, CommunityRole.ADMIN)).rejects.toThrow(
        InsufficientGroupRoleError,
      );
      await expect(service.setRole(group.id, MEMBER, MODERATOR, CommunityRole.MEMBER)).rejects.toThrow(
        InsufficientGroupRoleError,
      );
    });

    it('rejects an admin trying to promote someone to admin (their own rank)', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      await expect(service.setRole(group.id, ADMIN, MEMBER, CommunityRole.ADMIN)).rejects.toThrow(
        CannotAssignRoleAboveOwnRankError,
      );
    });

    it('rejects an admin self-promoting to owner', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      await expect(service.setRole(group.id, ADMIN, ADMIN, CommunityRole.OWNER)).rejects.toThrow(
        CannotAssignOwnerRoleError,
      );
    });

    it('rejects an admin self-promoting to their own rank (admin)', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      await expect(service.setRole(group.id, ADMIN, ADMIN, CommunityRole.ADMIN)).rejects.toThrow(
        CannotAssignRoleAboveOwnRankError,
      );
    });

    it('allows an admin to self-demote to moderator', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      const updated = await service.setRole(group.id, ADMIN, ADMIN, CommunityRole.MODERATOR);
      expect(updated.role).toBe(CommunityRole.MODERATOR);
    });

    it('rejects demoting or otherwise modifying the owner', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      await expect(service.setRole(group.id, ADMIN, OWNER, CommunityRole.MEMBER)).rejects.toThrow(
        CannotModifyOwnerRoleError,
      );
    });

    it('rejects assigning the owner role to a new target', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      await expect(service.setRole(group.id, OWNER, MEMBER, CommunityRole.OWNER)).rejects.toThrow(
        CannotAssignOwnerRoleError,
      );
    });

    it('throws NotGroupMemberError when the target is not a member', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });

      await expect(service.setRole(group.id, OWNER, OUTSIDER, CommunityRole.MODERATOR)).rejects.toThrow(
        NotGroupMemberError,
      );
    });
  });

  describe('listMembersWithBadges', () => {
    it('composes membership rows with resolveBadgeForKobaId results', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await seedRoles(group.id);

      const withBadges = await service.listMembersWithBadges(group.id);

      const ownerRow = withBadges.find((m) => m.memberKobaId === OWNER);
      const adminRow = withBadges.find((m) => m.memberKobaId === ADMIN);
      const moderatorRow = withBadges.find((m) => m.memberKobaId === MODERATOR);
      const memberRow = withBadges.find((m) => m.memberKobaId === MEMBER);

      expect(ownerRow?.badge).toEqual({ showBadge: true, badgeType: 'admin' });
      expect(adminRow?.badge).toEqual({ showBadge: true, badgeType: 'admin' });
      expect(moderatorRow?.badge).toEqual({ showBadge: true, badgeType: 'moderator' });
      expect(memberRow?.badge).toEqual({ showBadge: false });
    });
  });
});
