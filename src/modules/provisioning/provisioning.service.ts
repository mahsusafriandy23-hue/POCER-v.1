import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  PROVISIONING_PROVIDER,
  ProvisioningProvider,
} from './provisioning-provider.interface';
import { Order } from '@prisma/client';

/**
 * Voucher provisioning — mirrors legacy fulfill_voucher() single path
 * (VOUCHER_ENGINE.md §7). Idempotent on existing vouchers (BR-16, I-3).
 */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger('Provisioning');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVISIONING_PROVIDER) private readonly provider: ProvisioningProvider,
  ) {}

  /**
   * Add a package duration ("30d"/"24h"/"5m") to a base instant. Used to compute the
   * real expiry at FIRST LOGIN (not at generation). Exposed for the activation hook.
   */
  static addDuration(duration: string, from: Date): Date | null {
    const s = (duration ?? '').trim().toLowerCase();
    const m = /^(\d+)\s*([a-z]+)$/.exec(s);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2];
    const MS: Record<string, number> = {
      m: 60_000, min: 60_000, menit: 60_000,
      h: 3_600_000, hr: 3_600_000, jam: 3_600_000, j: 3_600_000,
      d: 86_400_000, day: 86_400_000, hari: 86_400_000,
      w: 604_800_000, week: 604_800_000, minggu: 604_800_000,
      mo: 2_592_000_000, month: 2_592_000_000, bulan: 2_592_000_000,
    };
    const ms = MS[unit];
    if (!ms) return null;
    return new Date(from.getTime() + n * ms);
  }

  /**
   * Provision the voucher(s) for a PAID order. Idempotent: if a voucher already
   * exists for the order, returns 'already_done' without creating a duplicate.
   */
  async provisionOrder(order: Order & { package?: { mikrotikProfile: string; duration: string; name: string } | null }): Promise<{
    status: 'created' | 'already_done' | 'failed' | 'not_paid' | 'missing_creds';
    error?: string;
  }> {
    if (order.status !== 'PAID') return { status: 'not_paid' };

    // Idempotency (BR-16, I-3)
    const existing = await this.prisma.voucher.findFirst({ where: { orderId: order.id } });
    if (existing || order.fulfillStatus === 'CREATED') {
      if (order.fulfillStatus !== 'CREATED') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { fulfillStatus: 'CREATED', fulfilledAt: order.fulfilledAt ?? new Date() },
        });
      }
      return { status: 'already_done' };
    }

    const username = order.voucherUsername;
    const password = order.voucherPassword;
    if (!username || !password) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { fulfillStatus: 'FAILED', fulfillError: 'username/password kosong' },
      });
      return { status: 'missing_creds' };
    }

    const pkg = order.package;
    const profile = pkg?.mikrotikProfile ?? 'default';
    const attempts = order.fulfillAttempts + 1;

    const result = await this.provider.createHotspotUser({
      username,
      password,
      profile,
      serverId: order.serverId ?? null,
      comment: `vc-${order.merchantRef}`,
    });

    if (!result.ok) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillStatus: 'FAILED',
          fulfillAttempts: attempts,
          fulfillError: result.error ?? 'provisioning failed',
        },
      });
      return { status: 'failed', error: result.error };
    }

    // Validity is NOT computed here. It starts at first login (see activation hook);
    // until then activatedAt/expiryDate are null. The router profile enforces cutoff.
    await this.prisma.$transaction([
      this.prisma.voucher.create({
        data: {
          orderId: order.id,
          customerId: order.customerId ?? null, // deliver into the customer's inbox
          username,
          password,
          profile,
          serverId: order.serverId ?? null,
          activatedAt: null,
          expiryDate: null,
          isActive: true,
        },
      }),
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillStatus: 'CREATED',
          fulfilledAt: new Date(),
          fulfillAttempts: attempts,
          fulfillError: null,
        },
      }),
    ]);

    return { status: 'created' };
  }
}
