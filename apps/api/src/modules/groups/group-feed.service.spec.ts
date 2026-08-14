import { GroupFeedService } from './group-feed.service';
import { GroupMembershipService } from './group-membership.service';
import { GroupService } from './group.service';
import { InMemoryGroupMembershipRepository } from './in-memory-group-membership.repository';
import { InMemoryGroupPostRepository } from './in-memory-group-post.repository';
import { InMemoryGroupRepository } from './in-memory-group.repository';
import { NotGroupMemberError, PrivateGroupRequiresMembershipError } from './group.errors';

describe('GroupFeedService', () => {
  let groupRepository: InMemoryGroupRepository;
  let membershipRepository: InMemoryGroupMembershipRepository;
  let postRepository: InMemoryGroupPostRepository;
  let groupService: GroupService;
  let membershipService: GroupMembershipService;
  let service: GroupFeedService;

  const OWNER = 'KOBA-PL-AAAA';
  const MEMBER = 'KOBA-PL-MEMB';
  const OUTSIDER = 'KOBA-PL-ZZZZ';

  beforeEach(() => {
    groupRepository = new InMemoryGroupRepository();
    membershipRepository = new InMemoryGroupMembershipRepository();
    postRepository = new InMemoryGroupPostRepository();
    groupService = new GroupService(groupRepository, membershipRepository);
    membershipService = new GroupMembershipService(membershipRepository, groupService);
    service = new GroupFeedService(postRepository, groupService, membershipService);
  });

  describe('getGroupFeed (public group)', () => {
    it('has no viewing restriction — even a non-member can read it', async () => {
      const group = await groupService.createGroup({ name: 'Open Group', visibility: 'public', ownerKobaId: OWNER });
      await service.createPost({ groupId: group.id, authorKobaId: OWNER, text: 'hello' });

      const feed = await service.getGroupFeed(group.id, OUTSIDER);
      expect(feed).toHaveLength(1);

      const anonymousFeed = await service.getGroupFeed(group.id);
      expect(anonymousFeed).toHaveLength(1);
    });
  });

  describe('getGroupFeed (private group)', () => {
    it('requires membership to view', async () => {
      const group = await groupService.createGroup({
        name: 'Secret Group',
        visibility: 'private',
        ownerKobaId: OWNER,
      });

      await expect(service.getGroupFeed(group.id, OUTSIDER)).rejects.toThrow(PrivateGroupRequiresMembershipError);
      await expect(service.getGroupFeed(group.id)).rejects.toThrow(PrivateGroupRequiresMembershipError);
    });

    it('allows a member to view', async () => {
      const group = await groupService.createGroup({
        name: 'Secret Group',
        visibility: 'private',
        ownerKobaId: OWNER,
      });
      await membershipService.addMember(group.id, OWNER, MEMBER);

      const feed = await service.getGroupFeed(group.id, MEMBER);
      expect(feed).toEqual([]);
    });

    it('allows the owner to view', async () => {
      const group = await groupService.createGroup({
        name: 'Secret Group',
        visibility: 'private',
        ownerKobaId: OWNER,
      });

      const feed = await service.getGroupFeed(group.id, OWNER);
      expect(feed).toEqual([]);
    });
  });

  describe('createPost', () => {
    it('requires membership — a member can post', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });
      await membershipService.join(group.id, MEMBER);

      const post = await service.createPost({ groupId: group.id, authorKobaId: MEMBER, text: 'hi everyone' });
      expect(post.id).toBeDefined();
      expect(post.groupId).toBe(group.id);
      expect(post.authorKobaId).toBe(MEMBER);
      expect(post.text).toBe('hi everyone');
      expect(post.createdAt).toBeInstanceOf(Date);

      const feed = await service.getGroupFeed(group.id);
      expect(feed).toEqual([post]);
    });

    it('rejects a non-member author', async () => {
      const group = await groupService.createGroup({ name: 'Group', visibility: 'public', ownerKobaId: OWNER });

      await expect(
        service.createPost({ groupId: group.id, authorKobaId: OUTSIDER, text: 'nope' }),
      ).rejects.toThrow(NotGroupMemberError);
    });
  });
});
