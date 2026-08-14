import { Module } from '@nestjs/common';
import { TdlsService } from './tdls.service';

@Module({
  providers: [TdlsService],
  exports: [TdlsService],
})
export class TdlsModule {}
