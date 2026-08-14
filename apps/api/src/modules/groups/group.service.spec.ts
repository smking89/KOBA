import { CommunityRole } from '../accounts/community-role.types';
import { InMemoryGroupMembershipRepository } from './in-memory-group-membership.repository';
import { InMemoryGroupRepository } from './in-memory-group.repository';
import { GroupNotFoundError, InsufficientGroupRoleError } from './group.errors';
import { GroupService } from './group.service';

describe('GroupService', () => {
  let groupRepository: InMemoryGroupRepository;
  let membershipRepository: InMemoryGroupMembershipRepository;
  let service: GroupService;

  const OWNER = 'KOBA-PL-AAAA';

  beforeEach(() => {
    groupRepository = new InMemoryGroupRepository();
    membershipRepository = new InMemoryGroupMembershipRepository();
    service = new GroupService(groupRepository, membershipRepository);
  });

  describe('createGroup', () => {
    it('creates a group with an immutable owner and auto-assigns the owner CommunityRole', async () => {
      const group = await service.createGroup({ name: 'Rust Raiders', visibility: 'public', ownerKobaId: OWNER });

      expect(group.id).toBeDefined();
      expect(group.name).toBe('Rust Raiders');
      expect(group.visibility).toBe('public');
      expect(group.ownerKobaId).toBe(OWNER);
      expect(group.allowTagging).toBe(true);
      expect(group.createdAt).toBeInstanceOf(Date);

      const membership = await membershipRepository.find(group.id, OWNER);
      expect(membership?.role).toBe(CommunityRole.OWNER);
    });

    it('creates a private group', async () => {
      const group = await service.createGroup({ name: 'Inner Circle', visibility: 'private', ownerKobaId: OWNER });
      expect(group.visibility).toBe('private');
    });
  });

  describe('getById / findById', () => {
    it('throws GroupNotFoundError for an unknown id', async () => {
      await expect(service.getById('does-not-exist')).rejects.toThrow(GroupNotFoundError);
    });

    it('findById returns null for an unknown id', async () => {
      expect(await service.findById('does-not-exist')).toBeNull();
    });
  });

  describe('allowTagging', () => {
    it('defaults to true and can be toggled by the owner', async () => {
      const group = await service.createGroup({ name: 'Rust Raiders', visibility: 'public', ownerKobaId: OWNER });
      expect(await service.isTaggingAllowed(group.id)).toBe(true);

      const updated = await service.setAllowTagging(group.id, OWNER, false);
      expect(updated.allowTagging).toBe(false);
      expect(await service.isTaggingAllowed(group.id)).toBe(false);

      const reEnabled = await service.setAllowTagging(group.id, OWNER, true);
      expect(reEnabled.allowTagging).toBe(true);
    });

    it('allows an admin (not just the owner) to toggle allowTagging', async () => {
      const group = await service.createGroup({ name: 'Rust Raiders', visibility: 'public', ownerKobaId: OWNER });
      await membershipRepository.save({
        groupId: group.id,
        memberKobaId: 'KOBA-PL-ADMN',
        role: CommunityRole.ADMIN,
        joinedAt: new Date(),
      });

      const updated = await service.setAllowTagging(group.id, 'KOBA-PL-ADMN', false);
      expect(updated.allowTagging).toBe(false);
    });

    it('rejects a non-owner/admin (e.g. a plain member or non-member)', async () => {
      const group = await service.createGroup({ name: 'Rust Raiders', visibility: 'public', ownerKobaId: OWNER });
      await membershipRepository.save({
        groupId: group.id,
        memberKobaId: 'KOBA-PL-MEMB',
        role: CommunityRole.MEMBER,
        joinedAt: new Date(),
      });

      await expect(service.setAllowTagging(group.id, 'KOBA-PL-MEMB', false)).rejects.toThrow(
        InsufficientGroupRoleError,
      );
      await expect(service.setAllowTagging(group.id, 'KOBA-PL-ZZZZ', false)).rejects.toThrow(
        InsufficientGroupRoleError,
      );
    });
  });
});
