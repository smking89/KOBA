import { Test } from '@nestjs/testing';
import { GroupFeedService } from './group-feed.service';
import { GroupMembershipService } from './group-membership.service';
import { GroupService } from './group.service';
import { GroupsModule } from './groups.module';
import { LfgService } from './lfg.service';

describe('GroupsModule (DI wiring)', () => {
  it('resolves every groups-module service through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GroupsModule],
    }).compile();

    expect(moduleRef.get(GroupService)).toBeInstanceOf(GroupService);
    expect(moduleRef.get(GroupMembershipService)).toBeInstanceOf(GroupMembershipService);
    expect(moduleRef.get(GroupFeedService)).toBeInstanceOf(GroupFeedService);
    expect(moduleRef.get(LfgService)).toBeInstanceOf(LfgService);

    await moduleRef.close();
  });
});
