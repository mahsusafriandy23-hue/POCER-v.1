import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { hashSecret } from '../../common/util/password';
import { normalizeWhatsapp } from '../../common/util/codes';
import { CreateAgentDto, UpdateAgentDto, AssignAgentOutletsDto } from './dto/owner.dto';

/** Owner-scoped management of the agents under a business owner. */
@Injectable()
export class OwnerAgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  private async isManageAll(adminId: number): Promise<boolean> {
    // A platform operator (superadmin) governs every outlet.
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { manageAllOutlets: true, isOperator: true },
    });
    return !!(admin?.manageAllOutlets || admin?.isOperator);
  }

  private async ownedServerIds(adminId: number): Promise<number[]> {
    const all = await this.isManageAll(adminId);
    const rows = await this.prisma.server.findMany({
      where: all ? {} : { ownerAdminId: adminId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Resolve & authorize the BRAND an agent belongs to. Defaults to the owner's
   *  only brand when unspecified; requires an explicit pick when they have several. */
  private async resolveAgentBrand(adminId: number, brandId?: number) {
    if (brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: brandId, ownerAdminId: adminId },
        select: { id: true },
      });
      if (!brand) throw new NotFoundException('Brand tidak ditemukan');
      return brand;
    }
    const brands = await this.prisma.brand.findMany({
      where: { ownerAdminId: adminId },
      select: { id: true },
      take: 2,
    });
    if (brands.length === 1) return brands[0];
    if (brands.length === 0) return null; // no brands yet → agent without brand
    throw new BadRequestException('Pilih brand untuk agen ini.');
  }

  /** Outlet ids an agent may be granted: its brand's outlets (or, if it has no
   *  brand, every outlet the owner manages). */
  private async agentAssignableServerIds(adminId: number, brandId: number | null): Promise<number[]> {
    if (brandId != null) {
      const rows = await this.prisma.server.findMany({
        where: { brandId },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    return this.ownedServerIds(adminId);
  }

  /** Guard: ensure an agent is in scope, else 404. A control-all admin scopes to any agent. */
  private async ownedAgent(adminId: number, agentId: number) {
    const all = await this.isManageAll(adminId);
    const agent = await this.prisma.agent.findFirst({
      where: all ? { id: agentId } : { id: agentId, adminId },
    });
    if (!agent) throw new NotFoundException('Agen tidak ditemukan');
    return agent;
  }

  async list(adminId: number) {
    const all = await this.isManageAll(adminId);
    const agents = await this.prisma.agent.findMany({
      where: all ? {} : { adminId },
      orderBy: { id: 'desc' },
      include: {
        outlets: { include: { server: { select: { id: true, code: true, name: true } } } },
        brand: { select: { id: true, name: true } },
      },
    });
    const out = [];
    for (const a of agents) {
      const bal = await this.wallet.balanceFor('AGENT', a.id);
      out.push({
        id: a.id,
        name: a.name,
        username: a.username,
        phone: a.phone,
        status: a.status,
        discountPercent: a.discountPercent ?? 0,
        balance: bal.balance,
        brand: a.brand ? { id: a.brand.id, name: a.brand.name } : null,
        outlets: a.outlets.map((o) => o.server),
      });
    }
    return out;
  }

  async get(adminId: number, agentId: number) {
    await this.ownedAgent(adminId, agentId);
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        outlets: { include: { server: { select: { id: true, code: true, name: true } } } },
        brand: { select: { id: true, name: true } },
      },
    });
    const bal = await this.wallet.balanceFor('AGENT', agentId);
    return {
      id: agent!.id,
      name: agent!.name,
      username: agent!.username,
      phone: agent!.phone,
      status: agent!.status,
      hasPin: !!agent!.pinHash,
      discountPercent: agent!.discountPercent ?? 0,
      balance: bal.balance,
      brand: agent!.brand ? { id: agent!.brand.id, name: agent!.brand.name } : null,
      outlets: agent!.outlets.map((o) => o.server),
    };
  }

  async create(adminId: number, dto: CreateAgentDto) {
    const phone = normalizeWhatsapp(dto.phone);
    if (!phone) throw new BadRequestException('Nomor WhatsApp tidak valid');
    const username = dto.username?.trim().toLowerCase() || null;
    const exists = await this.prisma.agent.findFirst({
      where: { OR: [{ phone }, ...(username ? [{ username }] : [])] },
    });
    if (exists) {
      throw new BadRequestException(
        username && exists.username === username ? 'Username sudah dipakai' : 'Nomor sudah terdaftar',
      );
    }
    const brand = await this.resolveAgentBrand(adminId, dto.brandId);
    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        phone,
        username,
        passwordHash: hashSecret(dto.password),
        pinHash: dto.pin ? hashSecret(dto.pin) : null,
        status: 'ACTIVE',
        adminId,
        brandId: brand?.id ?? null,
        discountPercent: dto.discountPercent ?? null,
      },
      select: { id: true, name: true, phone: true, username: true, status: true },
    });
    // Optionally assign outlets at creation.
    if (dto.serverIds?.length) {
      await this.assignOutlets(adminId, agent.id, dto.serverIds);
    }
    return agent;
  }

  async update(adminId: number, agentId: number, dto: UpdateAgentDto) {
    const agent = await this.ownedAgent(adminId, agentId);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password !== undefined) data.passwordHash = hashSecret(dto.password);
    if (dto.pin !== undefined) data.pinHash = dto.pin ? hashSecret(dto.pin) : null;
    if (dto.discountPercent !== undefined) data.discountPercent = dto.discountPercent;

    // Moving the agent to another brand: validate, set, and drop outlets that no
    // longer belong to the agent's (new) brand.
    let brandChanged = false;
    let newBrandId = agent.brandId;
    if (dto.brandId !== undefined && dto.brandId !== agent.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: dto.brandId, ownerAdminId: adminId },
        select: { id: true },
      });
      if (!brand) throw new NotFoundException('Brand tidak ditemukan');
      newBrandId = brand.id;
      brandChanged = true;
      data.brandId = newBrandId;
    }
    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data,
      select: { id: true, name: true, phone: true, username: true, status: true },
    });
    if (brandChanged) {
      const allowed = new Set(await this.agentAssignableServerIds(adminId, newBrandId));
      await this.prisma.agentOutlet.deleteMany({
        where: { agentId, serverId: { notIn: allowed.size ? [...allowed] : [-1] } },
      });
    }
    return updated;
  }

  /**
   * Delete an agent (owner-scoped). Cascades its outlet links + custom prices and
   * removes its wallet account (ledger/holds cascade); past orders are detached
   * (agentId → null) so sales history is preserved. Irreversible.
   */
  async remove(adminId: number, agentId: number) {
    await this.ownedAgent(adminId, agentId);
    await this.prisma.$transaction(async (tx) => {
      // Wallet is polymorphic (ownerType/ownerId) — not an FK — so remove explicitly;
      // its ledger entries and holds cascade at the DB level.
      await tx.account.deleteMany({ where: { ownerType: 'AGENT', ownerId: agentId } });
      // Agent row: cascades agent_outlets + agent_package_prices; orders.agentId → null.
      await tx.agent.delete({ where: { id: agentId } });
    });
    return { ok: true };
  }

  /** Admin credits an agent's wallet (agent paid cash). Owner-scoped. */
  async topup(adminId: number, agentId: number, amount: number, note?: string) {
    await this.ownedAgent(adminId, agentId);
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException('Nominal tidak valid');
    const account = await this.wallet.ensureAccount('AGENT', agentId);
    const reference = `OWNER-${adminId}-AGENTTOPUP-${Date.now()}-${randomBytes(4).toString('hex')}`;
    await this.wallet.credit(account.id, amount, 'TOPUP', reference, note ?? `Top-up oleh admin #${adminId}`);
    const bal = await this.wallet.balanceFor('AGENT', agentId);
    return { agentId, credited: amount, balance: bal.balance, reference };
  }

  /** Replace the agent's outlet permissions — must be within the agent's brand. */
  async assignOutlets(adminId: number, agentId: number, serverIds: number[]) {
    const agent = await this.ownedAgent(adminId, agentId);
    const allowed = await this.agentAssignableServerIds(adminId, agent.brandId);
    const invalid = serverIds.filter((id) => !allowed.includes(id));
    if (invalid.length) {
      throw new ForbiddenException(`Outlet di luar brand agen ini: ${invalid.join(', ')}`);
    }
    await this.prisma.$transaction([
      this.prisma.agentOutlet.deleteMany({ where: { agentId } }),
      ...(serverIds.length
        ? [
            this.prisma.agentOutlet.createMany({
              data: serverIds.map((serverId) => ({ agentId, serverId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    const outlets = await this.prisma.agentOutlet.findMany({
      where: { agentId },
      include: { server: { select: { id: true, code: true, name: true } } },
    });
    return { agentId, outlets: outlets.map((o) => o.server) };
  }
}
