import { Module } from '@nestjs/common';
import { GROUP_MEMBERSHIP_REPOSITORY } from './group-membership.repository';
import { GroupMembershipService } from './group-membership.service';
import { GROUP_POST_REPOSITORY } from './group-post.repository';
import { GroupFeedService } from './group-feed.service';
import { GROUP_REPOSITORY } from './group.repository';
import { GroupService } from './group.service';
import { InMemoryGroupMembershipRepository } from './in-memory-group-membership.repository';
import { InMemoryGroupPostRepository } from './in-memory-group-post.repository';
import { InMemoryGroupRepository } from './in-memory-group.repository';
import { InMemoryLfgPostRepository } from './in-memory-lfg.repository';
import { LFG_POST_REPOSITORY } from './lfg.repository';
import { LfgService } from './lfg.service';

/**
 * Groups + LFG (ROADMAP.md Phase 5). Reuses `accounts/`'s `CommunityRole`
 * enum and `resolveBadgeForKobaId()` via plain TS import — both are
 * framework-free (no `@Injectable`, not exported by `AccountsModule`'s
 * providers), so no Nest module import is needed for them (unlike
 * `shops.module.ts` importing `MarketplaceModule` to inject actual
 * services). `accounts/` itself is untouched by this module.
 */
@Module({
  providers: [
    GroupService,
    GroupMembershipService,
    GroupFeedService,
    LfgService,
    { provide: GROUP_REPOSITORY, useClass: InMemoryGroupRepository },
    { provide: GROUP_MEMBERSHIP_REPOSITORY, useClass: InMemoryGroupMembershipRepository },
    { provide: GROUP_POST_REPOSITORY, useClass: InMemoryGroupPostRepository },
    { provide: LFG_POST_REPOSITORY, useClass: InMemoryLfgPostRepository },
  ],
  exports: [GroupService, GroupMembershipService, GroupFeedService, LfgService],
})
export class GroupsModule {}
