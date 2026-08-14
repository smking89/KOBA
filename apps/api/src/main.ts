import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// NOTE: Phase 1 scope is service/DI layer only (KOBAID + accounts modules).
// No controllers are wired yet, so this bootstrap exists to prove the Nest
// application graph resolves cleanly; HTTP routes land in Phase 13.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

if (require.main === module) {
  bootstrap();
}
