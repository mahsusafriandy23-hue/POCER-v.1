import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { GobizAuthService } from '../gobiz/gobiz-auth.service';
import {
  PaymentDetectionProvider,
  Settlement,
} from '../payment-detection.interface';

/**
 * Real GoBiz detection adapter (session-aware). For every QRIS account that has a stored,
 * encrypted GoBiz refresh_token, it:
 *   1. refresh() → fresh access_token + merchant_id (and PERSISTS the rotated refresh_token —
 *      GoID rotates it every refresh, so we must save the new one or the session dies),
 *   2. POSTs api.gobiz.co.id/journals/search scoped to that merchant (faithful port of the
 *      proven legacy QRIS2 lib/gopay.js `generatePayload` + module.js detection),
 *   3. maps hits → settlements (gross_amount is in cents → ÷100).
 * Settlements from all connected accounts are merged; the reconciler matches by unique amount.
 *
 * Verified live: header set + refresh grant return HTTP 201 / 200 from a server (see
 * gobiz-auth.service.ts headers note). No external gateway/proxy required.
 */
@Injectable()
export class GobizDetectionProvider implements PaymentDetectionProvider {
  readonly name = 'gobiz';
  private readonly logger = new Logger('Detection:gobiz');
  private readonly journalsUrl: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly gobiz: GobizAuthService,
  ) {
    const base = (config.get<string>('GOID_BASE_URL', 'https://api.gobiz.co.id') || '').replace(/\/+$/, '');
    this.journalsUrl = `${base}/journals/search`;
    this.timeoutMs = Number(config.get('DETECTION_GATEWAY_TIMEOUT_MS', 12000)) || 12000;
  }

  async listSettlements(sinceMs: number): Promise<Settlement[]> {
    const accounts = await this.prisma.qrisAccount.findMany({
      where: { gobizRefreshTokenEnc: { not: null }, isActive: true },
    });
    if (!accounts.length) {
      this.logger.warn('no QRIS account connected to GoBiz — no settlements');
      return [];
    }

    const all: Settlement[] = [];
    for (const acc of accounts) {
      try {
        const refreshToken = this.crypto.decrypt(acc.gobizRefreshTokenEnc as string);
        const session = await this.gobiz.refresh(refreshToken);

        // Persist the rotated refresh_token (+ merchant_id) so the session stays alive.
        await this.prisma.qrisAccount.update({
          where: { id: acc.id },
          data: {
            gobizRefreshTokenEnc: this.crypto.encrypt(session.refreshToken),
            gobizMerchantId: session.merchantId ?? acc.gobizMerchantId,
          },
        });

        const merchantId = session.merchantId ?? acc.gobizMerchantId;
        if (!merchantId) {
          this.logger.warn(`QRIS#${acc.id} (${acc.label}): no merchant_id — skipped`);
          continue;
        }

        const hits = await this.searchJournals(session.accessToken, merchantId, sinceMs);
        for (const t of hits) {
          all.push({
            grossAmount: Math.round(Number(t.gross_amount) / 100),
            status: String(t.status ?? 'settlement'),
            externalId: t.id ?? t.order_id ?? t.reference_id,
            time: t.transaction_time,
          });
        }
        this.logger.log(`QRIS#${acc.id} (${acc.label}) merchant=${merchantId}: ${hits.length} hit(s)`);
      } catch (e: any) {
        this.logger.error(`QRIS#${acc.id} (${acc.label}) detection failed: ${e?.message ?? e}`);
        // fail-safe: skip this account, never emit false positives
      }
    }
    return all;
  }

  /** POST journals/search scoped to one merchant; returns the transaction metadata of each hit. */
  private async searchJournals(accessToken: string, merchantId: string, sinceMs: number): Promise<any[]> {
    const end = new Date();
    const start = new Date(end.getTime() - Math.max(sinceMs, 60_000));
    const payload = {
      from: 0,
      size: 50,
      sort: { time: { order: 'desc' } },
      included_categories: { incoming: ['transaction_share', 'action'] },
      query: [
        {
          op: 'and',
          clauses: [
            {
              op: 'not',
              clauses: [
                {
                  op: 'or',
                  clauses: [
                    { field: 'metadata.source', op: 'in', value: ['GOSAVE_ONLINE', 'GoSave', 'GODEALS_ONLINE'] },
                    { field: 'metadata.gopay.source', op: 'in', value: ['GOSAVE_ONLINE', 'GoSave', 'GODEALS_ONLINE'] },
                  ],
                },
              ],
            },
            {
              field: 'metadata.transaction.status',
              op: 'in',
              value: ['settlement', 'capture', 'refund', 'partial_refund'],
            },
            {
              field: 'metadata.transaction.payment_type',
              op: 'in',
              value: [
                'qris', 'gopay', 'cash', 'offline_ovo', 'offline_telkomsel_cash',
                'offline_credit_card', 'offline_debit_card', 'credit_card',
                'grab_food', 'shopee_food', 'traveloka_eats',
              ],
            },
            { field: 'metadata.transaction.transaction_time', op: 'gte', value: start.toISOString() },
            { field: 'metadata.transaction.transaction_time', op: 'lte', value: end.toISOString() },
            { field: 'metadata.transaction.merchant_id', op: 'equal', value: merchantId },
          ],
        },
      ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.journalsUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'authentication-type': 'go-id',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-uniqueid': randomUUID(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`journals/search HTTP ${res.status}`);
      const data: any = await res.json();
      const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
      return hits.map((h) => h?.metadata?.transaction).filter(Boolean);
    } finally {
      clearTimeout(timer);
    }
  }
}
