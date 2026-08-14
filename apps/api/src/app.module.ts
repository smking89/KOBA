import { Module } from '@nestjs/common';
import { KobaidModule } from './modules/kobaid/kobaid.module';
import { AccountsModule } from './modules/accounts/accounts.module';

@Module({
  imports: [KobaidModule, AccountsModule],
})
export class AppModule {}
