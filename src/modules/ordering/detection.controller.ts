import {
  Body,
  Controller,
  ForbiddenException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentReconcilerService } from './payment-reconciler.service';
import { SimDetectionProvider } from '../payments/providers/sim-detection.provider';

/**
 * DEV-ONLY detection controls (disabled in production):
 *  - inject a fake settlement into the sim detection store,
 *  - run a detection/reconciliation cycle on demand.
 * In production the cycle would run on a scheduler against the real provider.
 */
@Controller('payments/detection')
export class DetectionController {
  constructor(
    private readonly config: ConfigService,
    private readonly reconciler: PaymentReconcilerService,
    private readonly sim: SimDetectionProvider,
  ) {}

  private assertDev() {
    if (this.config.get<string>('NODE_ENV', 'development') === 'production') {
      throw new ForbiddenException('detection dev controls disabled in production');
    }
  }

  @Post('settle')
  settle(@Body() body: { amount: number; status?: string; time?: string }) {
    this.assertDev();
    this.sim.push({ grossAmount: Number(body.amount), status: body.status ?? 'settlement', time: body.time });
    return { ok: true, pushed: { amount: Number(body.amount), status: body.status ?? 'settlement' } };
  }

  @Post('run')
  run() {
    this.assertDev();
    return this.reconciler.runCycle();
  }
}
