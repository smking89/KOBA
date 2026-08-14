import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { NotGroupMemberError, PrivateGroupRequiresMembershipError } from './group.errors';
import { GROUP_POST_REPOSITORY, GroupPostRepository } from './group-post.repository';
import { GroupMembershipService } from './group-membership.service';
import { GroupService } from './group.service';
import { CreateGroupPostParams, GroupPost } from './group.types';

/**
 * A group's feed — a lightweight, reverse-chronological text feed scoped
 * to one Group (ROADMAP.md Phase 5: "build the group feed's data shape
 * now, wire it into the ranked feed [Phase 8] later"). NOT Phase 6's full
 * social layer — no likes/comments/shares/tagging enforcement.
 */
@Injectable()
export class GroupFeedService {
  constructor(
    @Inject(GROUP_POST_REPOSITORY) private readonly repository: GroupPostRepository,
    private readonly groupService: GroupService,
    private readonly membershipService: GroupMembershipService,
  ) {}

  /**
   * Public groups have no viewing restriction. Private groups require the
   * requester to be a member — throws `PrivateGroupRequiresMembershipError`
   * otherwise (including when `requesterKobaId` is omitted, i.e. an
   * unauthenticated/anonymous read).
   */
  async getGroupFeed(groupId: string, requesterKobaId?: string): Promise<GroupPost[]> {
    const group = await this.groupService.getById(groupId);

    if (group.visibility === 'private') {
      const isMember = requesterKobaId ? await this.membershipService.isMember(groupId, requesterKobaId) : false;
      if (!isMember) {
        throw new PrivateGroupRequiresMembershipError(groupId);
      }
    }

    return this.repository.listByGroupId(groupId);
  }

  /** Posting requires the author to currently be a member of the group
   * (`NotGroupMemberError` otherwise) — this also covers an author who was
   * never a member, or who is no longer one. */
  async createPost(params: CreateGroupPostParams): Promise<GroupPost> {
    await this.groupService.getById(params.groupId);

    const isMember = await this.membershipService.isMember(params.groupId, params.authorKobaId);
    if (!isMember) {
      throw new NotGroupMemberError(params.groupId, params.authorKobaId);
    }

    const post: GroupPost = {
      id: randomUUID(),
      groupId: params.groupId,
      authorKobaId: params.authorKobaId,
      text: params.text,
      createdAt: new Date(),
    };

    return this.repository.save(post);
  }
}
