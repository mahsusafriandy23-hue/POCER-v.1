import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  PAYMENT_DETECTION,
  PaymentDetectionProvider,
} from '../payments/payment-detection.interface';
import { OrderingService } from './ordering.service';

const REFUND_STATUSES = ['refund', 'partial_refund', 'chargeback']; // BR-14: never count as paid

export interface DetectionSummary {
  scanned: number;
  confirmed: number;
  late: number;
  expired: number;
  orphans: number;
  refundsIgnored: number;
}

/**
 * Pull-based payment detection + reconciliation. Closes audit risks:
 *  - E3 late payment: matches settlements even after a payment's TTL (no short-circuit).
 *  - E4 refunds: refund/partial_refund are excluded from "paid".
 *  - E5 reused amount: settlement.time must be >= payment.createdAt (time guard).
 *  - P2 expiry writer: unmatched, past-grace payments are marked EXPIRED on both sides.
 *  - orphans: matched-nothing settlements are logged for human follow-up (exceptions).
 */
@Injectable()
export class PaymentReconcilerService {
  private readonly logger = new Logger('Reconciler');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ordering: OrderingService,
    @Inject(PAYMENT_DETECTION) private readonly detection: PaymentDetectionProvider,
  ) {}

  private windowMs() {
    return Number(this.config.get('DETECTION_WINDOW_MS', 3_600_000)) || 3_600_000;
  }
  private graceMs() {
    return Number(this.config.get('DETECTION_GRACE_MS', 60_000)) || 0;
  }

  async runCycle(): Promise<DetectionSummary> {
    const now = Date.now();
    const settlements = await this.detection.listSettlements(this.windowMs());

    const refundsIgnored = settlements.filter((s) =>
      REFUND_STATUSES.includes(String(s.status).toLowerCase()),
    ).length;
    const paid = settlements.filter(
      (s) => !REFUND_STATUSES.includes(String(s.status).toLowerCase()),
    );

    const pending = await this.prisma.payment.findMany({ where: { status: 'PENDING' } });

    const summary: DetectionSummary = {
      scanned: pending.length,
      confirmed: 0,
      late: 0,
      expired: 0,
      orphans: 0,
      refundsIgnored,
    };
    const matchedAmounts = new Set<number>();

    for (const p of pending) {
      // amount match + time-guard (E5): settlement must not predate the order
      const match = paid.find(
        (s) =>
          s.grossAmount === p.totalAmount &&
          (!s.time || new Date(s.time).getTime() >= new Date(p.createdAt).getTime()),
      );

      if (match) {
        const wasExpired = p.expiresAt.getTime() <= now; // E3: confirm even if past TTL
        const r = await this.ordering.confirmPayment(p.reference);
        if (r.status !== 'unknown_reference' && r.status !== 'order_not_found') {
          summary.confirmed++;
          if (wasExpired) summary.late++;
          matchedAmounts.add(p.totalAmount);
        }
        continue;
      }

      // no match → expire if past TTL + grace (P2 expiry writer)
      if (p.expiresAt.getTime() + this.graceMs() <= now) {
        await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'EXPIRED' } });
        await this.prisma.order.updateMany({
          where: { id: p.orderId, status: 'UNPAID' },
          data: { status: 'EXPIRED' },
        });
        summary.expired++;
      }
    }

    // Orphans (E3 safety net): money seen, but no pending order matched it.
    const knownAmounts = new Set(pending.map((p) => p.totalAmount));
    const orphans = paid.filter((s) => !knownAmounts.has(s.grossAmount));
    if (orphans.length) {
      summary.orphans = orphans.length;
      await this.prisma.webhookEvent.create({
        data: {
          source: 'reconciler-orphan',
          valid: true,
          payload: { orphans } as any,
        },
      });
      this.logger.warn(`${orphans.length} orphan settlement(s) — logged for follow-up`);
    }

    this.logger.log(
      `cycle: scanned=${summary.scanned} confirmed=${summary.confirmed} (late=${summary.late}) expired=${summary.expired} orphans=${summary.orphans} refundsIgnored=${summary.refundsIgnored}`,
    );
    return summary;
  }
}
