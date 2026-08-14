import { Module } from '@nestjs/common';
import { KobaidModule } from '../kobaid/kobaid.module';
import { AccountSwitchController } from './account-switch.controller';
import { AccountSwitchService } from './account-switch.service';
import { CapabilityService } from './capability.service';
import { InterestsValidator } from './interests.validator';
import { TaggingPermissionService } from './tagging-permission.service';

@Module({
  imports: [KobaidModule],
  controllers: [AccountSwitchController],
  providers: [CapabilityService, InterestsValidator, AccountSwitchService, TaggingPermissionService],
  exports: [CapabilityService, InterestsValidator, AccountSwitchService, TaggingPermissionService],
})
export class AccountsModule {}
