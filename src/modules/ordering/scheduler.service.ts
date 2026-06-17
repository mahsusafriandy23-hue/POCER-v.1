import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../payments/payments.service';
import { PaymentReconcilerService } from './payment-reconciler.service';

/**
 * Background scheduler — runs the detection/reconciliation cycle and amount-lock
 * cleanup on an interval, so payment detection is automatic in production (no manual
 * /run). Opt-in via SCHEDULER_ENABLED=true. Uses a plain timer (no extra dependency);
 * a single-instance deployment is assumed (add a distributed lock before scaling out).
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Scheduler');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly reconciler: PaymentReconcilerService,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('SCHEDULER_ENABLED', 'false') !== 'true') {
      this.logger.log('disabled (set SCHEDULER_ENABLED=true to enable)');
      return;
    }
    const intervalMs = Number(this.config.get('SCHEDULER_INTERVAL_MS', 30000)) || 30000;
    this.logger.log(`enabled — reconciliation every ${Math.round(intervalMs / 1000)}s`);
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  private async tick(): Promise<void> {
    if (this.running) return; // prevent overlap
    this.running = true;
    try {
      await this.payments.cleanupAmountLocks();
      const summary = await this.reconciler.runCycle();
      if (summary.confirmed || summary.expired || summary.orphans) {
        this.logger.log(
          `auto: confirmed=${summary.confirmed} late=${summary.late} expired=${summary.expired} orphans=${summary.orphans}`,
        );
      }
    } catch (e: any) {
      this.logger.error(`tick failed: ${e?.message ?? e}`);
    } finally {
      this.running = false;
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
