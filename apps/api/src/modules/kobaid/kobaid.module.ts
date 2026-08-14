import { Module } from '@nestjs/common';
import { TdlsModule } from '../../common/tdls/tdls.module';
import { InMemoryKobaIdRepository } from './in-memory-kobaid.repository';
import { InMemoryStaffIssuanceLogRepository } from './in-memory-staff-issuance-log.repository';
import { KOBAID_REPOSITORY } from './kobaid.repository';
import { KobaidService } from './kobaid.service';
import { STAFF_ISSUANCE_LOG_REPOSITORY } from './staff-issuance-log.repository';

@Module({
  imports: [TdlsModule],
  providers: [
    KobaidService,
    { provide: KOBAID_REPOSITORY, useClass: InMemoryKobaIdRepository },
    { provide: STAFF_ISSUANCE_LOG_REPOSITORY, useClass: InMemoryStaffIssuanceLogRepository },
  ],
  exports: [KobaidService],
})
export class KobaidModule {}
