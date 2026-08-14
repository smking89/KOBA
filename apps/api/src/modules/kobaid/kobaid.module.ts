import { Module } from '@nestjs/common';
import { InMemoryKobaIdRepository } from './in-memory-kobaid.repository';
import { KOBAID_REPOSITORY } from './kobaid.repository';
import { KobaidService } from './kobaid.service';

@Module({
  providers: [
    KobaidService,
    { provide: KOBAID_REPOSITORY, useClass: InMemoryKobaIdRepository },
  ],
  exports: [KobaidService],
})
export class KobaidModule {}
