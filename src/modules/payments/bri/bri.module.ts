import { Module } from '@nestjs/common';
import { BriService } from './bri.service';

/** Exposes the BRIAPI (SNAP) client so payment + detection modules share one instance. */
@Module({
  providers: [BriService],
  exports: [BriService],
})
export class BriModule {}
