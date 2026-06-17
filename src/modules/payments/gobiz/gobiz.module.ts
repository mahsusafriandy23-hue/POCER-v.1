import { Module } from '@nestjs/common';
import { GobizAuthService } from './gobiz-auth.service';

/** Exposes GoBiz/GoID merchant auth so owner & detection modules can use one instance. */
@Module({
  providers: [GobizAuthService],
  exports: [GobizAuthService],
})
export class GobizModule {}
