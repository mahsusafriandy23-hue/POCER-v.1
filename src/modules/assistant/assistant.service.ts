import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Assistant (asisten) read surface. Everything is scoped to the outlets granted
 * to this assistant via AssistantOutlet — never the whole platform. Read-only.
 */
@Injectable()
export class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  /** The server ids this assistant is allowed to see. */
  async allowedServerIds(assistantId: number): Promise<number[]> {
    const rows = await this.prisma.assistantOutlet.findMany({
      where: { assistantId },
      select: { serverId: true },
    });
    return rows.map((r) => r.serverId);
  }

  async me(assistantId: number) {
    const a = await this.prisma.assistant.findUnique({
      where: { id: assistantId },
      include: {
        outlets: { include: { server: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!a) throw new NotFoundException('Asisten tidak ditemukan');
    return {
      id: a.id,
      name: a.name,
      username: a.username,
      status: a.status,
      canSell: a.canSell,
      outlets: a.outlets.map((o) => o.server),
    };
  }

  async outlets(assistantId: number) {
    const ids = await this.allowedServerIds(assistantId);
    if (!ids.length) return [];
    const rows = await this.prisma.server.findMany({
      where: { id: { in: ids } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { packages: true } } },
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      isActive: s.isActive,
      packageCount: s._count.packages,
    }));
  }

  /** Voucher transactions across the assistant's granted outlets only. */
  async transactions(
    assistantId: number,
    opts: { search?: string; status?: string; limit?: number } = {},
  ) {
    const ids = await this.allowedServerIds(assistantId);
    if (!ids.length) return [];
    const where: Record<string, unknown> = { serverId: { in: ids }, purpose: 'VOUCHER' };
    if (opts.status && ['UNPAID', 'PAID', 'EXPIRED', 'FAILED'].includes(opts.status)) {
      where.status = opts.status;
    }
    if (opts.search) {
      const s = opts.search.trim();
      where.OR = [
        { customerWhatsapp: { contains: s } },
        { merchantRef: { contains: s, mode: 'insensitive' as const } },
        { reference: { contains: s, mode: 'insensitive' as const } },
        { vouchers: { some: { username: { contains: s, mode: 'insensitive' as const } } } },
      ];
    }
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.limit ?? 100, 200),
      include: {
        package: { select: { name: true } },
        server: { select: { code: true, name: true } },
        agent: { select: { id: true, name: true, username: true } },
        vouchers: { select: { username: true }, take: 1 },
      },
    });
    return rows.map((o) => ({
      id: o.id,
      reference: o.reference ?? o.merchantRef,
      createdAt: o.createdAt,
      package: o.package?.name ?? '—',
      outlet: o.server ? { code: o.server.code, name: o.server.name } : null,
      agent: o.agent ?? null,
      customerWhatsapp: o.customerWhatsapp,
      amount: o.amount,
      status: o.status,
      fulfillStatus: o.fulfillStatus,
      voucher: o.vouchers[0]?.username ?? o.voucherUsername ?? null,
    }));
  }

  /** Sales summary scoped to the assistant's outlets (optional date window). */
  async summary(assistantId: number, fromIso?: string, toIso?: string) {
    const ids = await this.allowedServerIds(assistantId);
    if (!ids.length) return { totals: { orders: 0, revenue: 0 }, byOutlet: [] };
    const createdAt: Record<string, Date> = {};
    if (fromIso) createdAt.gte = new Date(fromIso);
    if (toIso) createdAt.lte = new Date(toIso);
    const where = {
      serverId: { in: ids },
      purpose: 'VOUCHER' as const,
      status: 'PAID' as const,
      ...(fromIso || toIso ? { createdAt } : {}),
    };
    const [agg, byServer, servers] = await Promise.all([
      this.prisma.order.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.order.groupBy({ by: ['serverId'], where, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.server.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } }),
    ]);
    const map = new Map(servers.map((s) => [s.id, s]));
    return {
      totals: { orders: agg._count._all, revenue: agg._sum.amount ?? 0 },
      byOutlet: byServer
        .map((r) => ({
          server: map.get(r.serverId!) ?? { id: r.serverId, code: '—', name: '—' },
          orders: r._count._all,
          revenue: r._sum.amount ?? 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }
}
