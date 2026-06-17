import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
  BuildQrInput,
} from './payment-provider.interface';
import { BriPaymentProvider } from './providers/bri-payment.provider';
import { Payment } from '@prisma/client';

const MAX_RESERVE_TRIES = 120; // mirrors legacy reserveUniqueTotal MAX_TRIES

/** Fields of QrisAccount needed to build a payment (provider + payload/creds). */
const QRIS_ACCOUNT_SELECT = {
  isActive: true,
  provider: true,
  qrisText: true,
  paymentMode: true,
  briBaseUrl: true,
  briClientId: true,
  briClientSecretEnc: true,
  briPrivateKeyEnc: true,
  briPartnerId: true,
  briMerchantId: true,
  briTerminalId: true,
  briChannelId: true,
} as const;

type QrisAccountRow = {
  isActive: boolean;
  provider: string;
  qrisText: string | null;
  paymentMode: string | null;
  briBaseUrl: string | null;
  briClientId: string | null;
  briClientSecretEnc: string | null;
  briPrivateKeyEnc: string | null;
  briPartnerId: string | null;
  briMerchantId: string | null;
  briTerminalId: string | null;
  briChannelId: string | null;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly briProvider: BriPaymentProvider,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  private ttlMs(): number {
    return Number(this.config.get('PAYMENT_TTL_MS', 3_600_000)) || 3_600_000;
  }

  /** Provider reference id, e.g. "INV-20260604ABCDEF" (mirrors legacy). */
  private generateReference(now: Date): string {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i++) rand += alphabet[bytes[i] % alphabet.length];
    return `INV-${y}${m}${d}${rand}`;
  }

  /**
   * Reserve a unique total = base + (1..99) via AmountLock UNIQUE (BR-9),
   * mirroring legacy reserveUniqueTotal.js.
   */
  private async reserveUniqueTotal(baseAmount: number): Promise<{ totalAmount: number; delta: number }> {
    const expiresAt = new Date(Date.now() + this.ttlMs());
    for (let i = 0; i < MAX_RESERVE_TRIES; i++) {
      const delta = randomInt(1, 100); // 1..99
      const total = baseAmount + delta;
      try {
        await this.prisma.amountLock.create({
          data: { totalAmount: total, expiresAt },
        });
        return { totalAmount: total, delta };
      } catch (e: any) {
        if (e?.code === 'P2002') continue; // unique violation → try another delta
        throw e;
      }
    }
    throw new InternalServerErrorException('Could not reserve a unique payment amount');
  }

  /** Periodic cleanup of expired locks (mirrors cleanupAmountLocks). */
  async cleanupAmountLocks(): Promise<void> {
    await this.prisma.amountLock.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }

  /** A QRIS account is usable when active and either a BRI account or a real EMVCo string. */
  private usableAccount(acc?: QrisAccountRow | null): QrisAccountRow | undefined {
    if (!acc?.isActive) return undefined;
    if (acc.provider === 'bri') return acc.briClientId ? acc : undefined; // BRI configured?
    if (acc.qrisText && acc.qrisText.includes('5802ID')) return acc; // valid static QRIS
    return undefined;
  }

  /**
   * Resolve the QRIS account (provider + payload/creds) for an order:
   *  - Voucher purchase (has an outlet) → that outlet's assigned QRIS (Server.qrisAccountId).
   *  - Wallet top-up (no outlet) → the provider's default top-up QRIS (owner's isTopupDefault).
   * Returns undefined when nothing valid is found, so the provider falls back to its template.
   */
  private async resolveOrderQris(orderId: number): Promise<QrisAccountRow | undefined> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        server: { select: { qrisAccount: { select: QRIS_ACCOUNT_SELECT } } },
        customer: { select: { brandId: true, providerAdminId: true } },
        agent: { select: { brandId: true, adminId: true } },
      },
    });
    if (!order) return undefined;

    // 1) Outlet-routed payment (voucher purchase).
    const outletAcc = this.usableAccount(order.server?.qrisAccount as QrisAccountRow | null);
    if (outletAcc) return outletAcc;

    // 2) Top-up (no outlet): route to the customer's/agent's BRAND default top-up
    //    merchant (1 brand = 1 top-up default). Falls back to the owning admin's
    //    default for legacy rows that predate brands.
    const brandId = order.customer?.brandId ?? order.agent?.brandId ?? null;
    if (brandId) {
      const def = await this.prisma.qrisAccount.findFirst({
        where: { brandId, isTopupDefault: true, isActive: true },
        select: QRIS_ACCOUNT_SELECT,
      });
      const topupAcc = this.usableAccount(def as QrisAccountRow | null);
      if (topupAcc) return topupAcc;
    }
    const providerAdminId = order.customer?.providerAdminId ?? order.agent?.adminId ?? null;
    if (providerAdminId) {
      const def = await this.prisma.qrisAccount.findFirst({
        where: { ownerAdminId: providerAdminId, isTopupDefault: true, isActive: true },
        select: QRIS_ACCOUNT_SELECT,
      });
      const topupAcc = this.usableAccount(def as QrisAccountRow | null);
      if (topupAcc) return topupAcc;
    }
    return undefined;
  }

  /** Build the BuildQrInput.bri credentials block (decrypting secrets) for a BRI account. */
  private briInput(acc: QrisAccountRow): BuildQrInput['bri'] {
    if (acc.provider !== 'bri' || !acc.briClientId || !acc.briClientSecretEnc || !acc.briPrivateKeyEnc) return null;
    return {
      baseUrl: (acc.briBaseUrl || 'https://sandbox.partner.api.bri.co.id').replace(/\/+$/, ''),
      clientId: acc.briClientId,
      clientSecret: this.crypto.decrypt(acc.briClientSecretEnc),
      privateKey: this.crypto.decrypt(acc.briPrivateKeyEnc),
      partnerId: acc.briPartnerId ?? '',
      merchantId: acc.briMerchantId ?? '',
      terminalId: acc.briTerminalId ?? '',
      channelId: acc.briChannelId ?? '',
    };
  }

  /**
   * Create a payment for an order: reserve unique total, build QR, persist Payment.
   * Returns the Payment row. (BR-9, BR-7)
   */
  async createForOrder(orderId: number, baseAmount: number): Promise<Payment> {
    const now = new Date();
    const { totalAmount, delta } = await this.reserveUniqueTotal(baseAmount);
    const reference = this.generateReference(now);
    const expiresAt = new Date(now.getTime() + this.ttlMs());
    const resolved = await this.resolveOrderQris(orderId);
    // Pick the payment backend per resolved QRIS account: BRI accounts issue the QR via
    // BRIAPI; everything else uses the configured default (gobiz/sim).
    const useBri = resolved?.provider === 'bri';
    const provider = useBri ? this.briProvider : this.provider;
    const { qrUrl } = await provider.buildQr({
      reference,
      originalAmount: baseAmount,
      totalAmount,
      ttlMs: this.ttlMs(),
      qrisText: resolved?.qrisText ?? undefined,
      paymentMode: resolved?.paymentMode ?? undefined,
      bri: useBri && resolved ? this.briInput(resolved) : null,
    });

    return this.prisma.payment.create({
      data: {
        orderId,
        reference,
        provider: provider.name,
        originalAmount: baseAmount,
        totalAmount,
        uniqueDelta: delta,
        qrUrl,
        status: 'PENDING',
        expiresAt,
      },
    });
  }

  /** Verify inbound webhook HMAC (BR-11) — constant-time. */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = this.config.get<string>('WEBHOOK_SECRET', '');
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /** Mark a payment paid (idempotent). Returns the linked orderId, or null if unknown. */
  async markPaidByReference(reference: string): Promise<number | null> {
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment) return null;
    if (payment.status !== 'PAID') {
      await this.prisma.payment.update({
        where: { reference },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }
    return payment.orderId;
  }

  /** Compute an HMAC signature (used by the dev simulator to post a valid webhook). */
  sign(rawBody: string): string {
    const secret = this.config.get<string>('WEBHOOK_SECRET', '');
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }
}
