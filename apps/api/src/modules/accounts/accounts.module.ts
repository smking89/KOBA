import { Module } from '@nestjs/common';
import { CapabilityService } from './capability.service';
import { InterestsValidator } from './interests.validator';

@Module({
  providers: [CapabilityService, InterestsValidator],
  exports: [CapabilityService, InterestsValidator],
})
export class AccountsModule {}
