import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// NOTE: Phase 1 scope is mostly service/DI layer (KOBAID + accounts
// modules); most HTTP routes land in Phase 13. The one exception is the
// account-switching endpoint (POST /accounts/switch), pulled forward per
// a later task's scope — see accounts/account-switch.controller.ts.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

if (require.main === module) {
  bootstrap();
}
