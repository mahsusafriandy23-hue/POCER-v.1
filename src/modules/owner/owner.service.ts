import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RouterOsClient } from '../provisioning/routeros/routeros-client';
import { GobizAuthService } from '../payments/gobiz/gobiz-auth.service';
import { decodeQrisImage } from './qris-decode';
import { normalizeWhatsapp } from '../../common/util/codes';
import { hashSecret } from '../../common/util/password';
import {
  UpdatePackageDto,
  OwnerCustomerTopupDto,
  CreateBrandDto,
  UpdateBrandDto,
  UpdateOutletDto,
  CreatePackageDto,
  CreateOutletDto,
  UpdateRouterDto,
  UpdateQrisDto,
  UpdateWhatsappDto,
  UpdateVoucherFormatDto,
  CreateQrisAccountDto,
  UpdateQrisAccountDto,
  AssignQrisOutletsDto,
  CreateCustomerDto,
  UpdateCustomerDto,
} from './dto/owner.dto';

/**
 * Owner (business-owner) console. Everything is scoped to the outlets the owner
 * manages (Server.ownerAdminId === adminId). The owner never sees other owners'
 * outlets, packages, agents, sales, or customers.
 */
@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly crypto: CryptoService,
    private readonly gobiz: GobizAuthService,
  ) {}

  /** Whether this admin governs every outlet (not just assigned ones).
   *  A platform operator (superadmin) always governs every outlet. */
  async isManageAll(adminId: number): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { manageAllOutlets: true, isOperator: true },
    });
    return !!(admin?.manageAllOutlets || admin?.isOperator);
  }

  /** Whether this admin is the platform superadmin/operator (sees everything). */
  async isOperator(adminId: number): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { isOperator: true },
    });
    return !!admin?.isOperator;
  }

  /** Brands operated by this owner (1 owner → many brands). Each brand groups its
   *  own outlets, QRIS and agents; the brand a thing belongs to decides which QRIS
   *  receives its payments. Read-only listing for the console brand switcher. */
  async listBrands(adminId: number) {
    const brands = await this.prisma.brand.findMany({
      where: { ownerAdminId: adminId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        _count: { select: { outlets: true, qrisAccounts: true, agents: true } },
      },
    });
    return brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      isActive: b.isActive,
      outletCount: b._count.outlets,
      qrisCount: b._count.qrisAccounts,
      agentCount: b._count.agents,
    }));
  }

  /** The brand's single active+configured receiver QRIS (or null). Used to route an
   *  outlet's payments when it joins/changes brand. */
  private async brandReceiverQrisId(brandId: number): Promise<number | null> {
    const q = await this.prisma.qrisAccount.findFirst({
      where: { brandId, isActive: true, OR: [{ qrisText: { not: null } }, { provider: 'bri' }] },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    return q?.id ?? null;
  }

  private slugify(s: string): string | null {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null;
  }

  /** Create a new brand under this owner. */
  async createBrand(adminId: number, dto: CreateBrandDto) {
    const name = dto.name.trim();
    let slug = this.slugify(dto.slug?.trim() || name);
    if (slug && (await this.prisma.brand.findUnique({ where: { slug } }))) {
      slug = null; // avoid unique clash; slug is optional
    }
    const last = await this.prisma.brand.findFirst({
      where: { ownerAdminId: adminId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const brand = await this.prisma.brand.create({
      data: { ownerAdminId: adminId, name, slug, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
    return { id: brand.id, name: brand.name, slug: brand.slug };
  }

  /** Rename / toggle a brand owned by this admin. */
  async updateBrand(adminId: number, id: number, dto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findFirst({ where: { id, ownerAdminId: adminId } });
    if (!brand) throw new NotFoundException('Brand tidak ditemukan');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) {
      const slug = this.slugify(dto.slug.trim());
      if (slug && slug !== brand.slug && (await this.prisma.brand.findUnique({ where: { slug } }))) {
        throw new BadRequestException('Slug sudah dipakai brand lain.');
      }
      data.slug = slug;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await this.prisma.brand.update({ where: { id }, data });
    return { ok: true };
  }

  /** The set of server ids this admin manages. manageAllOutlets → every outlet. */
  async ownedServerIds(adminId: number): Promise<number[]> {
    const all = await this.isManageAll(adminId);
    const rows = await this.prisma.server.findMany({
      where: all ? {} : { ownerAdminId: adminId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async me(adminId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      include: {
        _count: { select: { agents: true, outlets: true } },
      },
    });
    if (!admin) throw new NotFoundException('Owner tidak ditemukan');
    const manageAll = admin.manageAllOutlets || admin.isOperator;
    // For a control-all admin, counts span everything (not the explicit relations).
    const [outletCount, agentCount] = manageAll
      ? await Promise.all([this.prisma.server.count(), this.prisma.agent.count()])
      : [admin._count.outlets, admin._count.agents];
    return {
      id: admin.id,
      name: admin.name,
      username: admin.username,
      phone: admin.phone,
      status: admin.status,
      manageAllOutlets: manageAll,
      isOperator: admin.isOperator,
      agentCount,
      outletCount,
    };
  }

  async outlets(adminId: number) {
    const all = await this.isManageAll(adminId);
    const rows = await this.prisma.server.findMany({
      where: all ? {} : { ownerAdminId: adminId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { packages: true } } },
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      isActive: s.isActive,
      hasRouter: !!s.mikrotikIp,
      brandId: s.brandId,
      packageCount: s._count.packages,
      voucherCharset: s.voucherCharset,
      voucherUserMode: s.voucherUserMode,
      voucherLength: s.voucherLength,
    }));
  }

  /** Update an outlet's voucher-credential generation style (scoped to owned outlets). */
  async updateVoucherFormat(adminId: number, serverId: number, dto: UpdateVoucherFormatDto) {
    const owned = await this.ownedServerIds(adminId);
    if (!owned.includes(serverId)) throw new ForbiddenException('Outlet bukan milik Anda');
    const data: Record<string, unknown> = {};
    if (dto.voucherCharset !== undefined) data.voucherCharset = dto.voucherCharset;
    if (dto.voucherUserMode !== undefined) data.voucherUserMode = dto.voucherUserMode;
    if (dto.voucherLength !== undefined) data.voucherLength = dto.voucherLength;
    const s = await this.prisma.server.update({ where: { id: serverId }, data });
    return {
      id: s.id,
      voucherCharset: s.voucherCharset,
      voucherUserMode: s.voucherUserMode,
      voucherLength: s.voucherLength,
    };
  }

  /** Edit an outlet's display fields (scoped to outlets this admin manages). */
  async updateOutlet(adminId: number, serverId: number, dto: UpdateOutletDto) {
    const owned = await this.ownedServerIds(adminId);
    if (!owned.includes(serverId)) throw new ForbiddenException('Outlet bukan milik Anda');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.dnsName !== undefined) data.dnsName = dto.dnsName.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    // Moving the outlet to another brand: validate ownership and re-point its
    // payments to the new brand's receiver QRIS (or detach if the brand has none).
    let routeToQris: number | null | undefined;
    const current = await this.prisma.server.findUnique({ where: { id: serverId }, select: { brandId: true } });
    if (dto.brandId !== undefined && dto.brandId !== current?.brandId) {
      const brand = await this.prisma.brand.findFirst({ where: { id: dto.brandId, ownerAdminId: adminId }, select: { id: true } });
      if (!brand) throw new NotFoundException('Brand tidak ditemukan');
      data.brandId = brand.id;
      routeToQris = await this.brandReceiverQrisId(brand.id);
    }
    if (routeToQris !== undefined) data.qrisAccountId = routeToQris;
    const s = await this.prisma.server.update({ where: { id: serverId }, data });
    return { id: s.id, code: s.code, name: s.name, dnsName: s.dnsName, isActive: s.isActive, sortOrder: s.sortOrder, brandId: s.brandId };
  }

  /** Create a new outlet owned by this admin. Code is unique across the platform. */
  async createOutlet(adminId: number, dto: CreateOutletDto) {
    const code = dto.code.trim().toUpperCase();
    const clash = await this.prisma.server.findUnique({ where: { code } });
    if (clash) throw new BadRequestException(`Kode outlet "${code}" sudah dipakai`);
    let brandId: number | null = null;
    if (dto.brandId) {
      const brand = await this.prisma.brand.findFirst({ where: { id: dto.brandId, ownerAdminId: adminId }, select: { id: true } });
      if (!brand) throw new NotFoundException('Brand tidak ditemukan');
      brandId = brand.id;
    }
    const s = await this.prisma.server.create({
      data: {
        code,
        name: dto.name.trim(),
        dnsName: dto.dnsName?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        ownerAdminId: adminId,
        brandId,
        // Route new outlet to its brand's receiver QRIS, if any.
        qrisAccountId: brandId ? await this.brandReceiverQrisId(brandId) : null,
      },
    });
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      isActive: s.isActive,
      hasRouter: false,
      brandId: s.brandId,
      packageCount: 0,
      dnsName: s.dnsName,
      sortOrder: s.sortOrder,
    };
  }

  /** Create a package under one of the owner's outlets. */
  async createPackage(adminId: number, dto: CreatePackageDto) {
    const owned = await this.ownedServerIds(adminId);
    if (!owned.includes(dto.serverId)) throw new ForbiddenException('Outlet bukan milik Anda');
    if (dto.agentPrice !== undefined && dto.agentPrice !== null && dto.agentPrice > dto.price) {
      throw new BadRequestException('Harga agen tidak boleh lebih besar dari harga jual');
    }
    if (dto.originalPrice && dto.originalPrice <= dto.price) {
      throw new BadRequestException('Harga coret harus lebih besar dari harga jual');
    }
    const p = await this.prisma.package.create({
      data: {
        serverId: dto.serverId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        price: dto.price,
        agentPrice: dto.agentPrice ?? null,
        duration: dto.duration.trim(),
        mikrotikProfile: (dto.mikrotikProfile?.trim() || 'default'),
        isActive: dto.isActive ?? true,
        dataLimit: dto.dataLimit?.trim() || null,
        originalPrice: dto.originalPrice || null,
        promoLabel: dto.promoLabel?.trim() || null,
        bonusLabel: dto.bonusLabel?.trim() || null,
        isFlashSale: dto.isFlashSale ?? false,
      },
    });
    return { id: p.id, name: p.name, serverId: p.serverId };
  }

  /**
   * Delete a package the owner governs. Refuses if the package has any orders —
   * deleting would orphan transaction history; the owner should deactivate instead.
   */
  async deletePackage(adminId: number, packageId: number) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Paket tidak ditemukan');
    const owned = await this.ownedServerIds(adminId);
    if (pkg.serverId === null || !owned.includes(pkg.serverId)) {
      throw new ForbiddenException('Paket bukan milik outlet Anda');
    }
    const orderCount = await this.prisma.order.count({ where: { packageId } });
    if (orderCount > 0) {
      throw new BadRequestException(
        `Paket sudah dipakai pada ${orderCount} transaksi. Nonaktifkan saja agar riwayat tetap utuh.`,
      );
    }
    await this.prisma.package.delete({ where: { id: packageId } });
    return { id: packageId, deleted: true };
  }

  async listPackages(adminId: number, serverId?: number) {
    const owned = await this.ownedServerIds(adminId);
    if (!owned.length) return [];
    const where =
      serverId !== undefined
        ? owned.includes(serverId)
          ? { serverId }
          : (() => {
              throw new ForbiddenException('Outlet bukan milik Anda');
            })()
        : { serverId: { in: owned } };
    const rows = await this.prisma.package.findMany({
      where,
      orderBy: [{ serverId: 'asc' }, { price: 'asc' }],
      include: { server: { select: { id: true, code: true, name: true } } },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      agentPrice: p.agentPrice,
      duration: p.duration,
      mikrotikProfile: p.mikrotikProfile,
      isActive: p.isActive,
      dataLimit: p.dataLimit,
      originalPrice: p.originalPrice,
      promoLabel: p.promoLabel,
      bonusLabel: p.bonusLabel,
      isFlashSale: p.isFlashSale,
      server: p.server,
    }));
  }

  async updatePackage(adminId: number, packageId: number, dto: UpdatePackageDto) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Paket tidak ditemukan');
    const owned = await this.ownedServerIds(adminId);
    if (pkg.serverId === null || !owned.includes(pkg.serverId)) {
      throw new ForbiddenException('Paket bukan milik outlet Anda');
    }
    if (
      dto.agentPrice !== undefined &&
      dto.agentPrice !== null &&
      dto.price !== undefined &&
      dto.agentPrice > dto.price
    ) {
      throw new BadRequestException('Harga agen tidak boleh lebih besar dari harga jual');
    }
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.agentPrice !== undefined) data.agentPrice = dto.agentPrice;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.duration !== undefined) data.duration = dto.duration.trim();
    // Empty profile → fall back to "default" (matches create behaviour).
    if (dto.mikrotikProfile !== undefined) data.mikrotikProfile = dto.mikrotikProfile.trim() || 'default';
    // Promo fields: empty string clears the label (stored null).
    if (dto.originalPrice !== undefined) data.originalPrice = dto.originalPrice || null;
    if (dto.promoLabel !== undefined) data.promoLabel = dto.promoLabel.trim() || null;
    if (dto.bonusLabel !== undefined) data.bonusLabel = dto.bonusLabel.trim() || null;
    if (dto.isFlashSale !== undefined) data.isFlashSale = dto.isFlashSale;
    if (dto.dataLimit !== undefined) data.dataLimit = dto.dataLimit.trim() || null;
    const updated = await this.prisma.package.update({ where: { id: packageId }, data });
    return {
      id: updated.id,
      name: updated.name,
      price: updated.price,
      agentPrice: updated.agentPrice,
      isActive: updated.isActive,
      duration: updated.duration,
      mikrotikProfile: updated.mikrotikProfile,
      dataLimit: updated.dataLimit,
      originalPrice: updated.originalPrice,
      promoLabel: updated.promoLabel,
      bonusLabel: updated.bonusLabel,
      isFlashSale: updated.isFlashSale,
    };
  }

  /** Customers who have transacted on this owner's outlets, with wallet balance. */
  async listCustomers(adminId: number, search?: string) {
    const owned = await this.ownedServerIds(adminId);
    // Customers who ordered at this admin's outlets.
    const orderIds =
      owned.length > 0
        ? (
            await this.prisma.order.findMany({
              where: { serverId: { in: owned }, customerId: { not: null } },
              select: { customerId: true },
              distinct: ['customerId'],
            })
          ).map((o) => o.customerId!)
        : [];
    // Union: customers with orders OR registered under this admin.
    const where: Record<string, unknown> = {
      OR: [
        ...(orderIds.length ? [{ id: { in: orderIds } }] : []),
        { providerAdminId: adminId },
      ],
    };
    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { username: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 100,
    });
    const out = [];
    for (const c of customers) {
      const bal = await this.wallet.balanceFor('CUSTOMER', c.id);
      out.push({
        id: c.id,
        name: c.name,
        username: c.username,
        phone: c.phone,
        status: c.status,
        balance: bal.balance,
      });
    }
    return out;
  }

  /** Owner credits a customer's balance (cash top-up). */
  async topupCustomer(adminId: number, dto: OwnerCustomerTopupDto) {
    if (!dto.customerId && !dto.phone) throw new BadRequestException('Isi customerId atau phone');
    const where = dto.customerId
      ? { id: dto.customerId }
      : { phone: normalizeWhatsapp(dto.phone!) ?? '' };
    const customer = await this.prisma.customer.findUnique({ where });
    if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan');
    const account = await this.wallet.ensureAccount('CUSTOMER', customer.id);
    const reference = `OWNER-${adminId}-TOPUP-${Date.now()}-${randomBytes(4).toString('hex')}`;
    await this.wallet.credit(account.id, dto.amount, 'TOPUP', reference, dto.note ?? `Top-up owner #${adminId}`);
    const bal = await this.wallet.balanceFor('CUSTOMER', customer.id);
    return { customerId: customer.id, phone: customer.phone, credited: dto.amount, balance: bal.balance, reference };
  }

  // ── Customer CRUD ──

  private async ownedCustomerOrThrow(adminId: number, customerId: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Pelanggan tidak ditemukan');
    // Accessible if created under this provider OR has orders on this owner's outlets.
    if (customer.providerAdminId === adminId) return customer;
    const owned = await this.ownedServerIds(adminId);
    const linked = await this.prisma.order.count({
      where: { customerId, serverId: { in: owned } },
    });
    if (!linked) throw new ForbiddenException('Pelanggan tidak terdaftar di outlet Anda');
    return customer;
  }

  async createCustomer(adminId: number, dto: CreateCustomerDto) {
    const phone = normalizeWhatsapp(dto.phone);
    if (!phone) throw new BadRequestException('Nomor HP tidak valid');
    const username = dto.username?.trim().toLowerCase() ?? null;
    const dup = await this.prisma.customer.findFirst({
      where: { OR: [{ phone }, ...(username ? [{ username }] : [])] },
    });
    if (dup) throw new BadRequestException(
      username && dup.username === username ? 'Username sudah dipakai' : 'Nomor sudah terdaftar',
    );
    return this.prisma.customer.create({
      data: {
        name: dto.name,
        phone,
        username,
        passwordHash: hashSecret(dto.password),
        status: 'ACTIVE',
        providerAdminId: adminId,
      },
      select: { id: true, name: true, phone: true, username: true, status: true },
    });
  }

  async getCustomer(adminId: number, customerId: number) {
    const c = await this.ownedCustomerOrThrow(adminId, customerId);
    const bal = await this.wallet.balanceFor('CUSTOMER', c.id);
    const vouchers = await this.prisma.voucher.findMany({
      where: { customerId: c.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { order: { select: { package: { select: { name: true, duration: true } } } } },
    });
    const txns = await this.prisma.ledgerEntry.findMany({
      where: { account: { ownerType: 'CUSTOMER', ownerId: c.id } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return {
      id: c.id, name: c.name, username: c.username, phone: c.phone, status: c.status,
      balance: bal.balance,
      vouchers: vouchers.map((v) => ({
        id: v.id,
        username: v.username,
        password: v.password,
        profile: v.profile,
        activatedAt: v.activatedAt,
        expiryDate: v.expiryDate,
        isActive: v.isActive,
        createdAt: v.createdAt,
        packageName: v.order?.package?.name ?? null,
        duration: v.order?.package?.duration ?? null,
      })),
      transactions: txns.map((t) => ({
        id: t.id, direction: t.direction, type: t.type, amount: t.amount,
        balanceAfter: t.balanceAfter, description: t.description, createdAt: t.createdAt,
      })),
    };
  }

  async updateCustomer(adminId: number, customerId: number, dto: UpdateCustomerDto) {
    await this.ownedCustomerOrThrow(adminId, customerId);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password !== undefined) data.passwordHash = hashSecret(dto.password);
    if (dto.phone !== undefined) {
      const phone = normalizeWhatsapp(dto.phone);
      if (!phone) throw new BadRequestException('Nomor HP tidak valid');
      const dup = await this.prisma.customer.findFirst({ where: { phone, id: { not: customerId } } });
      if (dup) throw new BadRequestException('Nomor sudah dipakai pelanggan lain');
      data.phone = phone;
    }
    if (dto.username !== undefined) {
      const username = dto.username?.trim().toLowerCase() ?? null;
      if (username) {
        const dup = await this.prisma.customer.findFirst({ where: { username, id: { not: customerId } } });
        if (dup) throw new BadRequestException('Username sudah dipakai');
      }
      data.username = username;
    }
    return this.prisma.customer.update({
      where: { id: customerId },
      data,
      select: { id: true, name: true, phone: true, username: true, status: true },
    });
  }

  async deleteCustomer(adminId: number, customerId: number) {
    await this.ownedCustomerOrThrow(adminId, customerId);
    await this.prisma.$transaction(async (tx) => {
      // Remove wallet (ledger/holds cascade at DB level).
      await tx.account.deleteMany({ where: { ownerType: 'CUSTOMER', ownerId: customerId } });
      // Customer row: orders.customerId → null, vouchers cascade.
      await tx.customer.delete({ where: { id: customerId } });
    });
    return { ok: true };
  }

  /** Sales summary across the owner's outlets within an optional date window. */
  async reports(adminId: number, fromIso?: string, toIso?: string) {
    const owned = await this.ownedServerIds(adminId);
    if (!owned.length) {
      return { totals: { orders: 0, revenue: 0 }, byOutlet: [], byAgent: [] };
    }
    const createdAt: Record<string, Date> = {};
    if (fromIso) createdAt.gte = new Date(fromIso);
    if (toIso) createdAt.lte = new Date(toIso);
    const where = {
      serverId: { in: owned },
      purpose: 'VOUCHER' as const,
      status: 'PAID' as const,
      ...(fromIso || toIso ? { createdAt } : {}),
    };

    const [agg, byServer, byAgentRaw, servers, agents] = await Promise.all([
      this.prisma.order.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.order.groupBy({
        by: ['serverId'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.order.groupBy({
        by: ['agentId'],
        where: { ...where, agentId: { not: null } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.server.findMany({
        where: { id: { in: owned } },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.agent.findMany({
        where: { adminId },
        select: { id: true, name: true, username: true },
      }),
    ]);

    const serverMap = new Map(servers.map((s) => [s.id, s]));
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    // Daily series for the trend chart (bucketed in JS by YYYY-MM-DD).
    const rawForDays = await this.prisma.order.findMany({
      where,
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: 'asc' },
    });
    const dayMap = new Map<string, { orders: number; revenue: number }>();
    for (const o of rawForDays) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const e = dayMap.get(key) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += o.amount;
      dayMap.set(key, e);
    }
    const byDay = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

    return {
      byDay,
      totals: { orders: agg._count._all, revenue: agg._sum.amount ?? 0 },
      byOutlet: byServer
        .map((r) => ({
          server: serverMap.get(r.serverId!) ?? { id: r.serverId, code: '—', name: '—' },
          orders: r._count._all,
          revenue: r._sum.amount ?? 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      byAgent: byAgentRaw
        .map((r) => ({
          agent: agentMap.get(r.agentId!) ?? { id: r.agentId, name: '—', username: null },
          orders: r._count._all,
          revenue: r._sum.amount ?? 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  /** Recent transactions (orders) across the owner's outlets, with sold voucher. */
  async transactions(
    adminId: number,
    opts: { search?: string; status?: string; limit?: number } = {},
  ) {
    const owned = await this.ownedServerIds(adminId);
    if (!owned.length) return [];
    const where: Record<string, unknown> = { serverId: { in: owned }, purpose: 'VOUCHER' };
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
      customerId: o.customerId,
      amount: o.amount,
      fundingSource: o.fundingSource,
      status: o.status,
      fulfillStatus: o.fulfillStatus,
      voucher: o.vouchers[0]?.username ?? o.voucherUsername ?? null,
    }));
  }

  async deleteTransactions(adminId: number, ids: number[]) {
    if (!ids?.length) return { deleted: 0 };
    const owned = await this.ownedServerIds(adminId);
    if (!owned.length) throw new ForbiddenException('Tidak ada outlet yang dikelola');
    // Only delete orders that belong to outlets owned by this admin.
    const result = await this.prisma.order.deleteMany({
      where: { id: { in: ids }, serverId: { in: owned } },
    });
    return { deleted: result.count };
  }

  // ───────────────────────── Integrations / Settings ─────────────────────────

  /** Combined settings view: QRIS + WhatsApp (secrets masked) + per-outlet router status. */
  async settings(adminId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        name: true,
        brandName: true,
        qrisText: true,
        qrisMerchant: true,
        qrisNmid: true,
        waNumber: true,
        waGatewayUrl: true,
        waGatewayKeyEnc: true,
      },
    });
    if (!admin) throw new NotFoundException('Owner tidak ditemukan');

    const owned = await this.ownedServerIds(adminId);
    const servers = owned.length
      ? await this.prisma.server.findMany({
          where: { id: { in: owned } },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            mikrotikIp: true,
            mikrotikPort: true,
            mikrotikUser: true,
            mikrotikPassEnc: true,
          },
        })
      : [];

    return {
      profile: {
        name: admin.name,
        // Customer-facing provider/brand name. Falls back to the owner name when unset.
        brandName: admin.brandName ?? null,
      },
      qris: {
        // Never echo the full payload back; the form shows whether it's set + a short preview.
        configured: !!admin.qrisText,
        preview: admin.qrisText ? `${admin.qrisText.slice(0, 12)}…(${admin.qrisText.length} char)` : null,
        merchant: admin.qrisMerchant ?? null,
        nmid: admin.qrisNmid ?? null,
      },
      whatsapp: {
        number: admin.waNumber ?? null,
        gatewayUrl: admin.waGatewayUrl ?? null,
        hasKey: !!admin.waGatewayKeyEnc,
      },
      routers: servers.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        isActive: s.isActive,
        mikrotikIp: s.mikrotikIp,
        mikrotikPort: s.mikrotikPort,
        mikrotikUser: s.mikrotikUser,
        hasPassword: !!s.mikrotikPassEnc,
        configured: !!(s.mikrotikIp && s.mikrotikUser && s.mikrotikPassEnc),
      })),
    };
  }

  /** Update the customer-facing provider/brand name ("Penyedia Layanan"). */
  async updateProfile(adminId: number, brandName: string | undefined) {
    const data: Record<string, unknown> = {};
    if (brandName !== undefined) data.brandName = brandName.trim() || null;
    await this.prisma.admin.update({ where: { id: adminId }, data });
    return { ok: true };
  }

  async updateQris(adminId: number, dto: UpdateQrisDto) {
    const data: Record<string, unknown> = {};
    if (dto.qrisText !== undefined) data.qrisText = dto.qrisText.trim() || null;
    if (dto.qrisMerchant !== undefined) data.qrisMerchant = dto.qrisMerchant.trim() || null;
    if (dto.qrisNmid !== undefined) data.qrisNmid = dto.qrisNmid.trim() || null;
    await this.prisma.admin.update({ where: { id: adminId }, data });
    return { ok: true };
  }

  async updateWhatsapp(adminId: number, dto: UpdateWhatsappDto) {
    const data: Record<string, unknown> = {};
    if (dto.waNumber !== undefined) data.waNumber = dto.waNumber.trim() || null;
    if (dto.waGatewayUrl !== undefined) data.waGatewayUrl = dto.waGatewayUrl.trim() || null;
    if (dto.clearKey) {
      data.waGatewayKeyEnc = null;
    } else if (dto.waGatewayKey !== undefined && dto.waGatewayKey.trim()) {
      data.waGatewayKeyEnc = this.crypto.encrypt(dto.waGatewayKey.trim());
    }
    await this.prisma.admin.update({ where: { id: adminId }, data });
    return { ok: true };
  }

  /** Assert the outlet belongs to this owner, returning it. */
  private async ownedServerOrThrow(adminId: number, serverId: number) {
    const owned = await this.ownedServerIds(adminId);
    if (!owned.includes(serverId)) {
      throw new ForbiddenException('Outlet ini bukan milik Anda');
    }
    const s = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!s) throw new NotFoundException('Outlet tidak ditemukan');
    return s;
  }

  async updateRouter(adminId: number, serverId: number, dto: UpdateRouterDto) {
    await this.ownedServerOrThrow(adminId, serverId);
    const data: Record<string, unknown> = {};
    if (dto.clear) {
      data.mikrotikIp = null;
      data.mikrotikUser = null;
      data.mikrotikPassEnc = null;
    } else {
      if (dto.mikrotikIp !== undefined) data.mikrotikIp = dto.mikrotikIp.trim() || null;
      if (dto.mikrotikPort !== undefined) data.mikrotikPort = dto.mikrotikPort;
      if (dto.mikrotikUser !== undefined) data.mikrotikUser = dto.mikrotikUser.trim() || null;
      if (dto.mikrotikPass !== undefined && dto.mikrotikPass.trim()) {
        data.mikrotikPassEnc = this.crypto.encrypt(dto.mikrotikPass.trim());
      }
    }
    const updated = await this.prisma.server.update({ where: { id: serverId }, data });
    return {
      ok: true,
      configured: !!(updated.mikrotikIp && updated.mikrotikUser && updated.mikrotikPassEnc),
    };
  }

  /**
   * READ-ONLY connection test. Connects, logs in, and runs `/system/identity/print`
   * + `/system/resource/print` — NEVER writes to the router. Used by the owner UI
   * to verify credentials before any live provisioning is enabled (anti-damage).
   */
  async testRouter(adminId: number, serverId: number) {
    const s = await this.ownedServerOrThrow(adminId, serverId);
    if (!s.mikrotikIp || !s.mikrotikUser || !s.mikrotikPassEnc) {
      return { ok: false, error: 'Router belum dikonfigurasi (IP/user/password)' };
    }
    const timeoutMs = 8000;
    const client = new RouterOsClient();
    try {
      await client.connect(s.mikrotikIp, s.mikrotikPort, timeoutMs);
      const login = await client.login(s.mikrotikUser, this.crypto.decrypt(s.mikrotikPassEnc), timeoutMs);
      if (!login.ok) return { ok: false, error: `Login gagal: ${login.error ?? 'kredensial salah'}` };

      const identity = await client.print(['/system/identity/print'], timeoutMs);
      const resource = await client.print(['/system/resource/print'], timeoutMs);
      return {
        ok: true,
        identity: identity.rows[0]?.name ?? null,
        version: resource.rows[0]?.version ?? null,
        board: resource.rows[0]?.['board-name'] ?? null,
        uptime: resource.rows[0]?.uptime ?? null,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Gagal terhubung ke router' };
    } finally {
      client.close();
    }
  }

  async routerProfiles(adminId: number, serverId: number) {
    const s = await this.ownedServerOrThrow(adminId, serverId);
    if (!s.mikrotikIp || !s.mikrotikUser || !s.mikrotikPassEnc) {
      return { ok: false, profiles: [] as string[], error: 'Router belum dikonfigurasi' };
    }
    const timeoutMs = 8000;
    const client = new RouterOsClient();
    try {
      await client.connect(s.mikrotikIp, s.mikrotikPort, timeoutMs);
      const login = await client.login(s.mikrotikUser, this.crypto.decrypt(s.mikrotikPassEnc), timeoutMs);
      if (!login.ok) return { ok: false, profiles: [] as string[], error: `Login gagal: ${login.error ?? 'kredensial salah'}` };
      const result = await client.print(['/ip/hotspot/user/profile/print'], timeoutMs);
      const profiles = result.rows.map((r) => r['name']).filter(Boolean) as string[];
      return { ok: true, profiles };
    } catch (e: any) {
      return { ok: false, profiles: [] as string[], error: e?.message ?? 'Gagal terhubung ke router' };
    } finally {
      client.close();
    }
  }

  // ───────────────────────── QRIS accounts ─────────────────────────

  private qrisPreview(text: string | null): string | null {
    if (!text) return null;
    return `${text.slice(0, 12)}…(${text.length} char)`;
  }

  private async ownedQrisOrThrow(adminId: number, id: number) {
    const acc = await this.prisma.qrisAccount.findUnique({ where: { id } });
    if (!acc) throw new ForbiddenException('Akun QRIS ini bukan milik Anda');
    // The superadmin/operator may manage any provider's QRIS.
    if (acc.ownerAdminId !== adminId && !(await this.isOperator(adminId))) {
      throw new ForbiddenException('Akun QRIS ini bukan milik Anda');
    }
    return acc;
  }

  /**
   * List the owner's QRIS accounts (secrets masked) with the outlets routed to each,
   * plus every owned outlet and its current QRIS assignment — enough for the UI to
   * both display and reassign. Each outlet routes to at most one account.
   */
  async listQris(adminId: number) {
    // 1 owner → many brands. A payment method belongs to a brand; the brand's
    // outlets route to it. List the owner's brands (the attach choices) + their QRIS.
    const brands = await this.prisma.brand.findMany({
      where: { ownerAdminId: adminId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    const accounts = await this.prisma.qrisAccount.findMany({
      where: { ownerAdminId: adminId },
      orderBy: [{ brandId: 'asc' }, { id: 'asc' }],
      include: {
        servers: { select: { id: true, code: true, name: true }, orderBy: { sortOrder: 'asc' } },
        brand: { select: { id: true, name: true } },
      },
    });
    const outlets = await this.prisma.server.findMany({
      where: { ownerAdminId: adminId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, qrisAccountId: true, brandId: true },
    });
    return {
      brands,
      accounts: accounts.map((a) => ({
        id: a.id,
        label: a.label,
        // Which brand this QRIS belongs to (and whose outlets route here).
        brand: a.brand ? { id: a.brand.id, name: a.brand.name } : null,
        brandId: a.brandId,
        configured: !!a.qrisText,
        preview: this.qrisPreview(a.qrisText),
        merchant: a.merchant,
        nmid: a.nmid,
        isActive: a.isActive,
        isTopupDefault: a.isTopupDefault,
        paymentMode: a.paymentMode ?? null,
        paymentProvider: a.provider,
        bri: { configured: !!a.briClientSecretEnc, merchantId: a.briMerchantId, connectedAt: a.briConnectedAt },
        gobiz: {
          connected: !!a.gobizRefreshTokenEnc,
          phone: a.gobizPhone,
          merchantId: a.gobizMerchantId,
          connectedAt: a.gobizConnectedAt,
        },
        outlets: a.servers,
      })),
      outlets: outlets.map((o) => ({
        id: o.id,
        code: o.code,
        name: o.name,
        qrisAccountId: o.qrisAccountId,
        brandId: o.brandId,
      })),
    };
  }

  /** Resolve & authorize the BRAND a QRIS write targets. Defaults to the owner's
   *  only brand when unspecified; requires an explicit pick when they have several. */
  private async resolveBrandForWrite(adminId: number, brandId?: number) {
    if (brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: brandId, ownerAdminId: adminId },
      });
      if (!brand) throw new NotFoundException('Brand tidak ditemukan');
      return brand;
    }
    const brands = await this.prisma.brand.findMany({
      where: { ownerAdminId: adminId },
      take: 2,
    });
    if (brands.length === 1) return brands[0];
    if (brands.length === 0) throw new BadRequestException('Belum ada brand. Buat brand dulu.');
    throw new BadRequestException('Pilih brand untuk QRIS ini.');
  }

  async createQris(adminId: number, dto: CreateQrisAccountDto) {
    const brand = await this.resolveBrandForWrite(adminId, dto.brandId);
    // 1 brand = 1 QRIS: a brand may own at most one payment method.
    const existing = await this.prisma.qrisAccount.count({ where: { brandId: brand.id } });
    if (existing > 0) {
      throw new BadRequestException(
        'Brand ini sudah punya QRIS. Edit QRIS yang ada, atau hapus dulu sebelum menambah.',
      );
    }
    const acc = await this.prisma.qrisAccount.create({
      data: {
        ownerAdminId: brand.ownerAdminId,
        brandId: brand.id,
        label: dto.label.trim(),
        qrisText: dto.qrisText?.trim() || null,
        merchant: dto.merchant?.trim() || null,
        nmid: dto.nmid?.trim() || null,
      },
    });
    // 1 brand = 1 QRIS: once configured & active, this method becomes the brand's
    // single receiver — ALL the brand's outlets route here.
    await this.applyBrandRouting(
      acc.id,
      brand.id,
      (!!acc.qrisText || acc.provider === 'bri') && acc.isActive,
    );
    return { id: acc.id, label: acc.label };
  }

  /**
   * Make this method the SINGLE payment QRIS for its brand: every outlet of the
   * brand routes here (detaching them from any sibling method, since the FK is
   * single-valued). Skipped when the method isn't an active, configured receiver, so a
   * half-set-up or deactivated QRIS can't silently capture outlets and break detection.
   */
  private async applyBrandRouting(qrisId: number, brandId: number, eligible: boolean) {
    if (!eligible) return;
    await this.prisma.server.updateMany({
      where: { brandId },
      data: { qrisAccountId: qrisId },
    });
  }

  async updateQrisAccount(adminId: number, id: number, dto: UpdateQrisAccountDto) {
    const acc = await this.ownedQrisOrThrow(adminId, id);
    const data: Record<string, unknown> = {};
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.qrisText !== undefined) data.qrisText = dto.qrisText.trim() || null;
    if (dto.merchant !== undefined) data.merchant = dto.merchant.trim() || null;
    if (dto.nmid !== undefined) data.nmid = dto.nmid.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isTopupDefault !== undefined) data.isTopupDefault = dto.isTopupDefault;
    if (dto.paymentMode !== undefined) data.paymentMode = dto.paymentMode;

    // The owner may move the method to another BRAND; its outlets follow it.
    let newBrandId = acc.brandId;
    let brandChanged = false;
    if (dto.brandId !== undefined && dto.brandId !== acc.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: dto.brandId, ownerAdminId: adminId },
      });
      if (!brand) throw new NotFoundException('Brand tidak ditemukan');
      // 1 brand = 1 QRIS: refuse to move onto a brand that already has one.
      const taken = await this.prisma.qrisAccount.count({
        where: { brandId: dto.brandId, NOT: { id } },
      });
      if (taken > 0) {
        throw new BadRequestException('Brand tujuan sudah punya QRIS. Hapus QRIS-nya dulu.');
      }
      newBrandId = brand.id;
      brandChanged = true;
      data.brandId = newBrandId;
    }

    // When the method leaves its old brand, free the outlets it served there.
    // applyBrandRouting re-attaches the NEW brand's outlets below.
    if (brandChanged) {
      await this.prisma.server.updateMany({ where: { qrisAccountId: id }, data: { qrisAccountId: null } });
    }

    // Enforce a single top-up default per BRAND: setting one true clears the others
    // in the same brand (a customer of a brand tops up to that brand's QRIS).
    if (dto.isTopupDefault === true) {
      await this.prisma.$transaction([
        this.prisma.qrisAccount.updateMany({
          where: { brandId: newBrandId, isTopupDefault: true, NOT: { id } },
          data: { isTopupDefault: false },
        }),
        this.prisma.qrisAccount.update({ where: { id }, data }),
      ]);
    } else {
      await this.prisma.qrisAccount.update({ where: { id }, data });
    }
    // Saving an active, configured QRIS makes it the brand's single receiver for ALL
    // the brand's outlets (1 brand = 1 QRIS). Skipped when not configured or inactive.
    const fresh = await this.prisma.qrisAccount.findUnique({ where: { id } });
    if (newBrandId != null) {
      await this.applyBrandRouting(
        id,
        newBrandId,
        (!!fresh?.qrisText || fresh?.provider === 'bri') && !!fresh?.isActive,
      );
    }
    return { ok: true };
  }

  /** Delete a QRIS account; its outlets fall back to unassigned (SetNull). */
  async deleteQris(adminId: number, id: number) {
    await this.ownedQrisOrThrow(adminId, id);
    // Explicitly unassign first so the response is deterministic even if FK cascade differs.
    await this.prisma.server.updateMany({ where: { qrisAccountId: id }, data: { qrisAccountId: null } });
    await this.prisma.qrisAccount.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Set exactly which owned outlets route to this QRIS account. Outlets listed are
   * attached here (and thereby detached from any other account, since the FK is
   * single-valued); owned outlets previously on this account but omitted are cleared.
   */
  async assignQrisOutlets(adminId: number, id: number, dto: AssignQrisOutletsDto) {
    const acc = await this.ownedQrisOrThrow(adminId, id);
    if (acc.brandId == null) {
      throw new BadRequestException('QRIS ini belum terhubung ke brand.');
    }
    // A payment method routes ONLY to outlets of its OWN brand
    // (Server.brandId === acc.brandId) — never another brand's outlet.
    const owned = new Set(
      (
        await this.prisma.server.findMany({
          where: { brandId: acc.brandId },
          select: { id: true },
        })
      ).map((s) => s.id),
    );
    const target = dto.serverIds.filter((sid) => owned.has(sid));
    const foreign = dto.serverIds.filter((sid) => !owned.has(sid));
    if (foreign.length) {
      throw new ForbiddenException(`Outlet di luar brand ini: ${foreign.join(', ')}`);
    }
    await this.prisma.$transaction([
      // Clear owned outlets currently on this account but no longer selected.
      this.prisma.server.updateMany({
        where: { qrisAccountId: id, id: { notIn: target.length ? target : [-1] } },
        data: { qrisAccountId: null },
      }),
      // Attach the selected outlets to this account (moves them off any other account).
      this.prisma.server.updateMany({
        where: { id: { in: target.length ? target : [-1] } },
        data: { qrisAccountId: id },
      }),
    ]);
    return { ok: true, assigned: target.length };
  }

  // ── GoBiz merchant session (enables real payment detection) ──

  async gobizRequestOtp(adminId: number, qrisId: number, phone: string) {
    await this.ownedQrisOrThrow(adminId, qrisId);
    if (!/^[0-9+\-\s]{8,16}$/.test(phone || '')) throw new BadRequestException('Nomor HP tidak valid');
    const { otpToken } = await this.gobiz.requestOtp(phone);
    return { ok: true, otpToken };
  }

  async gobizVerifyOtp(adminId: number, qrisId: number, otpToken: string, otp: string, phone?: string) {
    await this.ownedQrisOrThrow(adminId, qrisId);
    const session = await this.gobiz.verifyOtp(otpToken, otp);
    await this.storeGobizSession(qrisId, session, phone);
    return { ok: true, connected: true, merchantId: session.merchantId };
  }

  /** Primary: connect via GoBiz email/phone + password (the proven legacy flow). */
  async gobizLoginPassword(adminId: number, qrisId: number, identifier: string, password: string) {
    await this.ownedQrisOrThrow(adminId, qrisId);
    const session = await this.gobiz.loginWithPassword(identifier, password);
    if ((session as any).otpRequired) {
      return { ok: false, otpRequired: true, message: 'GoID meminta verifikasi OTP tambahan untuk akun ini.' };
    }
    await this.storeGobizSession(qrisId, session, identifier);
    return { ok: true, connected: true, merchantId: session.merchantId };
  }

  /** Fallback: connect using a refresh_token captured from a logged-in GoBiz browser session. */
  async gobizConnectRefreshToken(adminId: number, qrisId: number, refreshToken: string) {
    await this.ownedQrisOrThrow(adminId, qrisId);
    const session = await this.gobiz.refresh(refreshToken.trim());
    await this.storeGobizSession(qrisId, session);
    return { ok: true, connected: true, merchantId: session.merchantId };
  }

  /** Configure BRIAPI (SNAP) credentials for a QRIS account → switches it to provider 'bri'. */
  async setQrisBri(
    adminId: number,
    qrisId: number,
    dto: {
      clientId: string;
      clientSecret: string;
      privateKey: string;
      partnerId: string;
      merchantId: string;
      terminalId: string;
      channelId: string;
      baseUrl?: string;
    },
  ) {
    await this.ownedQrisOrThrow(adminId, qrisId);
    await this.prisma.qrisAccount.update({
      where: { id: qrisId },
      data: {
        provider: 'bri',
        briClientId: dto.clientId.trim(),
        briClientSecretEnc: this.crypto.encrypt(dto.clientSecret.trim()),
        briPrivateKeyEnc: this.crypto.encrypt(dto.privateKey.trim()),
        briPartnerId: dto.partnerId.trim(),
        briMerchantId: dto.merchantId.trim(),
        briTerminalId: dto.terminalId.trim(),
        briChannelId: dto.channelId.trim(),
        briBaseUrl: dto.baseUrl?.trim() || null,
        briConnectedAt: new Date(),
      },
    });
    return { ok: true, provider: 'bri' };
  }

  /** Switch a QRIS account back to GoBiz (clears BRI creds). */
  async unsetQrisBri(adminId: number, qrisId: number) {
    await this.ownedQrisOrThrow(adminId, qrisId);
    await this.prisma.qrisAccount.update({
      where: { id: qrisId },
      data: {
        provider: 'gobiz',
        briClientSecretEnc: null,
        briPrivateKeyEnc: null,
        briConnectedAt: null,
      },
    });
    return { ok: true, provider: 'gobiz' };
  }

  private async storeGobizSession(
    qrisId: number,
    session: { refreshToken: string; merchantId: string | null },
    phone?: string,
  ) {
    await this.prisma.qrisAccount.update({
      where: { id: qrisId },
      data: {
        gobizRefreshTokenEnc: this.crypto.encrypt(session.refreshToken),
        gobizMerchantId: session.merchantId,
        gobizConnectedAt: new Date(),
        ...(phone ? { gobizPhone: phone.trim() } : {}),
      },
    });
  }

  async gobizDisconnect(adminId: number, qrisId: number) {
    await this.ownedQrisOrThrow(adminId, qrisId);
    await this.prisma.qrisAccount.update({
      where: { id: qrisId },
      data: { gobizRefreshTokenEnc: null, gobizMerchantId: null, gobizConnectedAt: null, gobizPhone: null },
    });
    return { ok: true };
  }

  /**
   * Decode an uploaded QRIS photo → extract the exact payload + best-effort merchant
   * fields. Does NOT persist; the UI fills the form with this and the owner saves.
   */
  async decodeQrisFromImage(file?: { buffer?: Buffer; mimetype?: string; size?: number }) {
    if (!file?.buffer?.length) throw new BadRequestException('File gambar tidak ada');
    if (file.mimetype && !/^image\//.test(file.mimetype)) {
      throw new BadRequestException('File harus berupa gambar (foto/screenshot QRIS)');
    }
    if (file.size && file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Ukuran gambar maksimal 5MB');
    }
    try {
      return await decodeQrisImage(file.buffer);
    } catch (e: any) {
      throw new BadRequestException(e?.message ?? 'Gagal membaca QRIS dari gambar');
    }
  }

  /** Which QRIS account an outlet routes to (for verifying the payment routing). */
  async resolveQrisForServer(adminId: number, serverId: number) {
    const s = await this.ownedServerOrThrow(adminId, serverId);
    if (!s.qrisAccountId) return { server: { id: s.id, code: s.code }, qris: null };
    const acc = await this.prisma.qrisAccount.findUnique({ where: { id: s.qrisAccountId } });
    return {
      server: { id: s.id, code: s.code },
      qris: acc
        ? { id: acc.id, label: acc.label, merchant: acc.merchant, configured: !!acc.qrisText }
        : null,
    };
  }
}
