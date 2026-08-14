import { Module } from '@nestjs/common';
import { KobaidModule } from '../kobaid/kobaid.module';
import { AccountSwitchController } from './account-switch.controller';
import { AccountSwitchService } from './account-switch.service';
import { CapabilityService } from './capability.service';
import { InterestsValidator } from './interests.validator';

@Module({
  imports: [KobaidModule],
  controllers: [AccountSwitchController],
  providers: [CapabilityService, InterestsValidator, AccountSwitchService],
  exports: [CapabilityService, InterestsValidator, AccountSwitchService],
})
export class AccountsModule {}
