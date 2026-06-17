import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Account, LedgerEntry, Hold } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

export interface ApplyEntryInput {
  direction: 'CREDIT' | 'DEBIT';
  type: 'TOPUP' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT';
  amount: number; // positive
  referenceId?: string | null;
  relatedHoldId?: number | null;
  description?: string;
}

/**
 * Wallet/ledger engine. Account-agnostic (agent now, customer later).
 * Preserves BR-23 (atomic, no-negative, balanceAfter), BR-24 (idempotent),
 * BR-25 (refund). Implements the Reserve→Settle/Release saga (WALLET_ARCHITECTURE).
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get-or-create a wallet for any owner (AGENT or CUSTOMER). */
  async ensureAccount(ownerType: 'AGENT' | 'CUSTOMER' | 'SYSTEM', ownerId: number): Promise<Account> {
    return this.prisma.account.upsert({
      where: { ownerType_ownerId: { ownerType, ownerId } },
      update: {},
      create: { ownerType, ownerId },
    });
  }

  async balanceFor(ownerType: 'AGENT' | 'CUSTOMER' | 'SYSTEM', ownerId: number) {
    const account = await this.ensureAccount(ownerType, ownerId);
    const held = await this.prisma.hold.aggregate({
      where: { accountId: account.id, status: 'ACTIVE' },
      _sum: { amount: true },
    });
    const heldAmount = held._sum.amount ?? 0;
    return {
      currency: account.currency,
      balance: account.balance,
      held: heldAmount,
      available: account.balance - heldAmount,
    };
  }

  async ledgerFor(
    ownerType: 'AGENT' | 'CUSTOMER' | 'SYSTEM',
    ownerId: number,
    limit = 50,
  ): Promise<(LedgerEntry & { voucherCode: string | null })[]> {
    const account = await this.ensureAccount(ownerType, ownerId);
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { accountId: account.id },
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    // Attach the voucher code for PURCHASE rows so the UI can render a copy button.
    // referenceId on a purchase entry == the order's (unique) merchantRef, so this
    // also back-fills the code for older rows whose description lacked it.
    const refs = Array.from(
      new Set(
        entries
          .filter((e) => e.type === 'PURCHASE' && e.referenceId)
          .map((e) => e.referenceId as string),
      ),
    );
    const codeByRef = new Map<string, string>();
    if (refs.length) {
      const orders = await this.prisma.order.findMany({
        where: { merchantRef: { in: refs } },
        select: {
          merchantRef: true,
          voucherUsername: true,
          vouchers: { select: { username: true }, take: 1 },
        },
      });
      for (const o of orders) {
        const code = o.vouchers[0]?.username ?? o.voucherUsername ?? null;
        if (code) codeByRef.set(o.merchantRef, code);
      }
    }
    return entries.map((e) => ({
      ...e,
      voucherCode: e.referenceId ? codeByRef.get(e.referenceId) ?? null : null,
    }));
  }

  // ── core: apply a ledger entry under a row lock, idempotently ──
  private async applyEntry(tx: Tx, accountId: number, input: ApplyEntryInput): Promise<LedgerEntry> {
    // Lock the account row (BR-23, WI-6)
    await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${accountId} FOR UPDATE`;

    // Idempotency (BR-24, WI-4)
    if (input.referenceId) {
      const existing = await tx.ledgerEntry.findUnique({
        where: {
          accountId_type_referenceId: {
            accountId,
            type: input.type,
            referenceId: input.referenceId,
          },
        },
      });
      if (existing) return existing;
    }

    const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
    const delta = input.direction === 'CREDIT' ? input.amount : -input.amount;
    const newBalance = account.balance + delta;
    if (newBalance < 0) throw new BadRequestException('Insufficient balance'); // WI-2

    const entry = await tx.ledgerEntry.create({
      data: {
        accountId,
        direction: input.direction,
        type: input.type,
        amount: input.amount,
        balanceAfter: newBalance,
        referenceId: input.referenceId ?? null,
        relatedHoldId: input.relatedHoldId ?? null,
        description: input.description,
      },
    });
    await tx.account.update({ where: { id: accountId }, data: { balance: newBalance } });
    return entry;
  }

  /** Credit funds (top-up / refund / bonus). Idempotent per (account,type,ref). */
  async credit(accountId: number, amount: number, type: 'TOPUP' | 'REFUND' | 'ADJUSTMENT', referenceId: string, description?: string) {
    if (amount <= 0) throw new BadRequestException('amount must be positive');
    return this.prisma.$transaction((tx) =>
      this.applyEntry(tx, accountId, { direction: 'CREDIT', type, amount, referenceId, description }),
    );
  }

  /** Reserve funds for a purchase (creates an ACTIVE hold). Checks available (WI-2). */
  async reserve(accountId: number, amount: number, referenceId: string, ttlMs: number): Promise<Hold> {
    if (amount <= 0) throw new BadRequestException('amount must be positive');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${accountId} FOR UPDATE`;
      // Idempotency: existing active/settled hold for this order reference
      const existing = await tx.hold.findFirst({
        where: { accountId, referenceId, status: { in: ['ACTIVE', 'SETTLED'] } },
      });
      if (existing) return existing;

      const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
      const held = await tx.hold.aggregate({
        where: { accountId, status: 'ACTIVE' },
        _sum: { amount: true },
      });
      const available = account.balance - (held._sum.amount ?? 0);
      if (available < amount) throw new BadRequestException('Insufficient balance');

      return tx.hold.create({
        data: { accountId, amount, referenceId, status: 'ACTIVE', expiresAt: new Date(Date.now() + ttlMs) },
      });
    });
  }

  /** Settle a hold → converts to a PURCHASE debit (WI-5). Idempotent. */
  async settle(holdId: number, description?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const hold = await tx.hold.findUnique({ where: { id: holdId } });
      if (!hold) throw new NotFoundException('hold not found');
      if (hold.status === 'SETTLED') return;
      if (hold.status !== 'ACTIVE') throw new BadRequestException(`hold not active (${hold.status})`);

      await this.applyEntry(tx, hold.accountId, {
        direction: 'DEBIT',
        type: 'PURCHASE',
        amount: hold.amount,
        referenceId: hold.referenceId,
        relatedHoldId: hold.id,
        description,
      });
      await tx.hold.update({ where: { id: holdId }, data: { status: 'SETTLED' } });
    });
  }

  /** Release a hold without charging (purchase failed) → funds freed (WI-5). */
  async release(holdId: number): Promise<void> {
    await this.prisma.hold.updateMany({
      where: { id: holdId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
  }
}
