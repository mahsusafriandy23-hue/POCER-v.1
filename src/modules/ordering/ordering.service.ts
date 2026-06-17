import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { PaymentsService } from '../payments/payments.service';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletService } from '../wallet/wallet.service';
import { AuthService } from '../identity/auth.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { generateCode, generateMerchantRef, normalizeWhatsapp } from '../../common/util/codes';
import { RouterOsClient } from '../provisioning/routeros/routeros-client';
import { CryptoService } from '../../common/crypto/crypto.service';

const WALLET_HOLD_TTL_MS = 600_000; // 10 min safety window for the purchase saga

@Injectable()
export class OrderingService {
  private readonly logger = new Logger('Ordering');

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly payments: PaymentsService,
    private readonly provisioning: ProvisioningService,
    private readonly notifications: NotificationsService,
    private readonly wallet: WalletService,
    private readonly auth: AuthService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Generate voucher credentials honoring the outlet's configured style
   * (Server.voucherCharset / voucherUserMode / voucherLength). Falls back to the
   * legacy numeric/7+safe/6 defaults when the outlet has no setting. Computed in a
   * single call so USER_EQ_PASS can reuse the same code for username and password.
   */
  private async voucherCredsForServer(
    serverId: number | null,
  ): Promise<{ username: string; password: string }> {
    let charset = 'numeric';
    let userMode = 'USER_PASS';
    let length = 6;
    if (serverId != null) {
      const s = await this.prisma.server.findUnique({
        where: { id: serverId },
        select: { voucherCharset: true, voucherUserMode: true, voucherLength: true },
      });
      if (s) {
        charset = s.voucherCharset;
        userMode = s.voucherUserMode;
        length = s.voucherLength;
      }
    }
    // "campuran" → 'safe' (alphanumeric minus confusing 0/1/o/l/i); "angka semua" → 'numeric'.
    const pattern = charset === 'alphanumeric' ? 'safe' : 'numeric';
    const username = generateCode(pattern, length);
    const password = userMode === 'USER_EQ_PASS' ? username : generateCode(pattern, length);
    return { username, password };
  }

  // ───────────────── Retail order (QRIS) ─────────────────
  async createOrder(dto: CreateOrderDto) {
    const pkg = await this.catalog.getPackage(dto.packageId);
    if (!pkg.isActive) throw new BadRequestException('Package is not active'); // BR-3
    const creds = await this.voucherCredsForServer(pkg.serverId ?? null);
    const whatsapp = normalizeWhatsapp(dto.customerWhatsapp); // BR-8
    if (!whatsapp) throw new BadRequestException('Invalid WhatsApp number');

    const order = await this.prisma.order.create({
      data: {
        merchantRef: generateMerchantRef(Date.now()), // BR-5
        packageId: pkg.id,
        serverId: pkg.serverId ?? null, // BR-17
        purpose: 'VOUCHER',
        fundingSource: 'QRIS',
        qty: 1,
        customerWhatsapp: whatsapp,
        amount: pkg.price,
        originalAmount: pkg.price,
        paymentMethod: 'QRIS',
        status: 'UNPAID',
        fulfillStatus: 'PENDING',
        voucherUsername: creds.username, // BR-6 (style per outlet)
        voucherPassword: creds.password,
      },
    });

    const payment = await this.payments.createForOrder(order.id, pkg.price); // BR-9
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        reference: payment.reference, // BR-7
        amount: payment.totalAmount,
        totalAmount: payment.totalAmount,
        checkoutUrl: payment.qrUrl,
        expiresAt: payment.expiresAt,
      },
    });

    return {
      reference: updated.reference,
      merchantRef: updated.merchantRef,
      status: updated.status,
      package: { id: pkg.id, name: pkg.name },
      payment: {
        method: 'QRIS',
        originalAmount: payment.originalAmount,
        totalAmount: payment.totalAmount,
        qrUrl: payment.qrUrl,
        expiresAt: payment.expiresAt,
      },
    };
  }

  // ───────────────── Agent outlet scope ─────────────────
  /** Outlets an agent is permitted to sell for (empty = legacy/unrestricted). */
  async agentAllowedServerIds(agentId: number): Promise<number[]> {
    const rows = await this.prisma.agentOutlet.findMany({
      where: { agentId },
      select: { serverId: true },
    });
    return rows.map((r) => r.serverId);
  }

  /**
   * Enforce that an agent may sell a package's outlet. If the agent has explicit
   * outlet assignments, the package's server must be one of them. Agents with no
   * assignment are treated as legacy/unrestricted (transition-safe).
   */
  private async assertAgentMaySell(agentId: number, serverId: number | null | undefined) {
    const allowed = await this.agentAllowedServerIds(agentId);
    if (allowed.length === 0) return; // unrestricted (legacy)
    if (serverId == null || !allowed.includes(serverId)) {
      throw new ForbiddenException('Anda tidak berhak menjual untuk outlet ini');
    }
  }

  /** Agent profile + wallet balance + assigned outlets (for the agent console). */
  async agentProfile(agentId: number) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        outlets: { include: { server: { select: { id: true, code: true, name: true } } } },
        admin: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
    if (!agent) throw new NotFoundException('Agen tidak ditemukan');
    const bal = await this.wallet.balanceFor('AGENT', agentId);
    return {
      id: agent.id,
      name: agent.name,
      username: agent.username,
      phone: agent.phone,
      status: agent.status,
      hasPin: !!agent.pinHash,
      // The agent's "penyedia" is its BRAND (mascaFi / Penanggak .NET), not the
      // back-office owner. Fall back to the owner only if no brand is set.
      owner: agent.brand
        ? { id: agent.brand.id, name: agent.brand.name }
        : agent.admin,
      brand: agent.brand ? { id: agent.brand.id, name: agent.brand.name } : null,
      balance: bal.balance,
      outlets: agent.outlets.map((o) => o.server),
    };
  }

  async agentServerStatus(agentId: number) {
    const allowed = await this.agentAllowedServerIds(agentId);
    const where = allowed.length ? { id: { in: allowed } } : { isActive: true };
    const servers = await this.prisma.server.findMany({
      where,
      select: { id: true, code: true, name: true, mikrotikIp: true, mikrotikPort: true, mikrotikUser: true, mikrotikPassEnc: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return Promise.all(
      servers.map(async (s) => {
        if (!s.mikrotikIp || !s.mikrotikUser || !s.mikrotikPassEnc) {
          return { id: s.id, code: s.code, name: s.name, online: false, error: 'Belum dikonfigurasi' };
        }
        const t0 = Date.now();
        const client = new RouterOsClient();
        try {
          await client.connect(s.mikrotikIp, s.mikrotikPort ?? 8728, 4000);
          const login = await client.login(s.mikrotikUser, this.crypto.decrypt(s.mikrotikPassEnc), 4000);
          const latencyMs = Date.now() - t0;
          client.close();
          if (!login.ok) return { id: s.id, code: s.code, name: s.name, online: false, error: 'Login gagal' };
          return { id: s.id, code: s.code, name: s.name, online: true, latencyMs };
        } catch (e: any) {
          client.close();
          return { id: s.id, code: s.code, name: s.name, online: false, error: 'Tidak terjangkau' };
        }
      }),
    );
  }

  async agentChartData(agentId: number) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const orders = await this.prisma.order.findMany({
      where: { agentId, status: 'PAID', createdAt: { gte: startOfMonth } },
      select: { createdAt: true, amount: true },
      orderBy: { createdAt: 'asc' },
    });
    const map: Record<number, { count: number; revenue: number }> = {};
    orders.forEach((o) => {
      const d = new Date(o.createdAt).getDate();
      if (!map[d]) map[d] = { count: 0, revenue: 0 };
      map[d].count++;
      map[d].revenue += o.amount;
    });
    const today = now.getDate();
    return Array.from({ length: today }, (_, i) => ({
      day: i + 1,
      count: map[i + 1]?.count ?? 0,
      revenue: map[i + 1]?.revenue ?? 0,
    }));
  }

  async agentStats(agentId: number) {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month] = await Promise.all([
      this.prisma.order.aggregate({ where: { agentId, status: 'PAID', createdAt: { gte: startOfDay } }, _count: true, _sum: { amount: true } }),
      this.prisma.order.aggregate({ where: { agentId, status: 'PAID', createdAt: { gte: startOfWeek } }, _count: true, _sum: { amount: true } }),
      this.prisma.order.aggregate({ where: { agentId, status: 'PAID', createdAt: { gte: startOfMonth } }, _count: true, _sum: { amount: true } }),
    ]);

    return {
      today:  { count: today._count,  revenue: today._sum.amount  ?? 0 },
      week:   { count: week._count,   revenue: week._sum.amount   ?? 0 },
      month:  { count: month._count,  revenue: month._sum.amount  ?? 0 },
    };
  }

  /** Outlets the agent can sell for. Falls back to all active outlets when unrestricted. */
  async agentOutlets(agentId: number) {
    const allowed = await this.agentAllowedServerIds(agentId);
    const where = allowed.length ? { id: { in: allowed } } : { isActive: true };
    const rows = await this.prisma.server.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true, isActive: true },
    });
    return rows;
  }

  /**
   * Outlets visible to a customer: only their provider's (Penyedia Layanan)
   * active outlets. If the customer hasn't chosen a provider yet, fall back to
   * all active outlets (so the storefront isn't empty).
   */
  async customerOutlets(customerId: number) {
    const c = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { brandId: true, providerAdminId: true },
    });
    // Prefer the customer's BRAND (a customer belongs to one brand → sees its
    // outlets). Fall back to the owning admin for legacy rows; else all active.
    const where = c?.brandId
      ? { isActive: true, brandId: c.brandId }
      : c?.providerAdminId
        ? { isActive: true, ownerAdminId: c.providerAdminId }
        : { isActive: true };
    return this.prisma.server.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        dnsName: true,
        sortOrder: true,
        latitude: true,
        longitude: true,
        serviceRadiusKm: true,
      },
    });
  }

  /**
   * The price an agent pays for a package (BR-4):
   *   explicit package agentPrice → else retail × (1 − agentDiscount%) → else retail.
   */
  agentPriceFor(
    pkg: { price: number; agentPrice?: number | null },
    discountPercent?: number | null,
  ): number {
    if (pkg.agentPrice != null) return pkg.agentPrice;
    if (discountPercent && discountPercent > 0) {
      return Math.round((pkg.price * (100 - discountPercent)) / 100);
    }
    return pkg.price;
  }

  /** Packages the agent can sell, with the effective agent price applied. */
  async agentPackages(agentId: number, serverId?: number) {
    const allowed = await this.agentAllowedServerIds(agentId);
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { discountPercent: true },
    });
    const scope: Record<string, unknown> = { isActive: true };
    if (allowed.length) scope.serverId = { in: allowed };
    if (serverId !== undefined) {
      if (allowed.length && !allowed.includes(serverId)) {
        throw new ForbiddenException('Outlet di luar izin Anda');
      }
      scope.serverId = serverId;
    }
    const rows = await this.prisma.package.findMany({
      where: scope,
      orderBy: [{ serverId: 'asc' }, { price: 'asc' }],
      include: { server: { select: { id: true, code: true, name: true } } },
    });
    // The agent's own custom selling prices (markup to the end customer).
    const priceRows = await this.prisma.agentPackagePrice.findMany({
      where: { agentId, packageId: { in: rows.map((r) => r.id) } },
      select: { packageId: true, sellPrice: true },
    });
    const sellMap = new Map(priceRows.map((r) => [r.packageId, r.sellPrice]));
    return rows.map((p) => {
      const cost = this.agentPriceFor(p, agent?.discountPercent);
      const sellPrice = sellMap.get(p.id) ?? p.price; // default to package retail
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        agentPrice: cost, // the agent's COST (set by owner)
        sellPrice, // the agent's SELLING price to the customer
        margin: sellPrice - cost,
        customSellPrice: sellMap.has(p.id),
        duration: p.duration,
        isActive: p.isActive,
        server: p.server,
      };
    });
  }

  /** Set the agent's own selling price for a package (must be >= their cost). */
  async setAgentSellPrice(agentId: number, packageId: number, sellPrice: number) {
    if (!Number.isInteger(sellPrice) || sellPrice < 0) {
      throw new BadRequestException('Harga jual tidak valid');
    }
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, price: true, agentPrice: true, serverId: true },
    });
    if (!pkg) throw new NotFoundException('Paket tidak ditemukan');
    // Agent may only price packages within their assigned outlets.
    const allowed = await this.agentAllowedServerIds(agentId);
    if (allowed.length && (pkg.serverId == null || !allowed.includes(pkg.serverId))) {
      throw new ForbiddenException('Paket di luar izin Anda');
    }
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { discountPercent: true },
    });
    const cost = this.agentPriceFor(pkg, agent?.discountPercent);
    if (sellPrice < cost) {
      throw new BadRequestException(`Harga jual tidak boleh di bawah modal (Rp${cost.toLocaleString('id-ID')})`);
    }
    const row = await this.prisma.agentPackagePrice.upsert({
      where: { agentId_packageId: { agentId, packageId } },
      create: { agentId, packageId, sellPrice },
      update: { sellPrice },
    });
    return { packageId, sellPrice: row.sellPrice, agentPrice: cost, margin: row.sellPrice - cost };
  }

  // ───────────────── Agent top-up (QRIS → wallet credit) ─────────────────
  async createTopup(agentId: number, amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException('amount invalid');
    // The QR is routed server-side to the agent's PENYEDIA (owner) default top-up
    // QRIS — resolveOrderQris uses order.agent.adminId → that owner's isTopupDefault
    // account. No per-transaction outlet selection: the provider is the agent's.
    await this.wallet.ensureAccount('AGENT', agentId);
    const order = await this.prisma.order.create({
      data: {
        merchantRef: generateMerchantRef(Date.now()),
        agentId,
        purpose: 'AGENT_TOPUP',
        fundingSource: 'QRIS',
        customerWhatsapp: '-',
        amount,
        originalAmount: amount,
        paymentMethod: 'QRIS',
        status: 'UNPAID',
        fulfillStatus: 'PENDING',
      },
    });
    const payment = await this.payments.createForOrder(order.id, amount);
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        reference: payment.reference,
        amount: payment.totalAmount,
        totalAmount: payment.totalAmount,
        checkoutUrl: payment.qrUrl,
        expiresAt: payment.expiresAt,
      },
    });
    return {
      reference: payment.reference,
      purpose: 'AGENT_TOPUP',
      payment: {
        originalAmount: payment.originalAmount,
        totalAmount: payment.totalAmount,
        qrUrl: payment.qrUrl,
        expiresAt: payment.expiresAt,
      },
    };
  }

  // ───────────────── Agent wallet purchase (Reserve→Settle/Release saga) ─────────────────
  async agentWalletPurchase(agentId: number, packageId: number, customerWhatsapp: string, pin?: string) {
    const pkg = await this.catalog.getPackage(packageId);
    if (!pkg.isActive) throw new BadRequestException('Package is not active');
    const creds = await this.voucherCredsForServer(pkg.serverId ?? null);
    await this.assertAgentMaySell(agentId, pkg.serverId);
    const whatsapp = normalizeWhatsapp(customerWhatsapp);
    if (!whatsapp) throw new BadRequestException('Invalid WhatsApp number');

    // PIN step-up (BR-28)
    const pinOk = await this.auth.verifyPin(agentId, pin ?? '');
    if (!pinOk) throw new ForbiddenException('PIN required/invalid');

    const buyer = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { discountPercent: true },
    });
    const price = this.agentPriceFor(pkg, buyer?.discountPercent); // BR-4: override→agent_price→discount→retail
    const account = await this.wallet.ensureAccount('AGENT', agentId);
    const merchantRef = generateMerchantRef(Date.now());

    const order = await this.prisma.order.create({
      data: {
        merchantRef,
        reference: merchantRef, // wallet orders have no provider ref
        packageId: pkg.id,
        serverId: pkg.serverId ?? null,
        agentId,
        purpose: 'VOUCHER',
        fundingSource: 'WALLET',
        qty: 1,
        customerWhatsapp: whatsapp,
        amount: price,
        originalAmount: price,
        paymentMethod: 'WALLET',
        status: 'UNPAID',
        fulfillStatus: 'PENDING',
        voucherUsername: creds.username,
        voucherPassword: creds.password,
      },
    });

    // RESERVE (throws if insufficient → order left UNPAID, effectively void)
    const hold = await this.wallet.reserve(account.id, price, merchantRef, WALLET_HOLD_TTL_MS);

    // mark PAID (funding = wallet)
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    // PROVISION
    const full = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { package: { select: { mikrotikProfile: true, duration: true, name: true } } },
    });
    const result = await this.provisioning.provisionOrder(full);

    if (result.status === 'created' || result.status === 'already_done') {
      // Ledger memo carries the voucher code + recipient so the agent history is self-explanatory.
      await this.wallet.settle(hold.id, `Voucher ${pkg.name} • Kode ${creds.username} → ${whatsapp}`); // SETTLE → debit (BR-25 happy path)
      const voucher = await this.prisma.voucher.findFirst({ where: { orderId: order.id } });
      if (voucher) {
        await this.notifications.sendVoucher({
          to: whatsapp,
          packageName: pkg.name,
          username: voucher.username,
          password: voucher.password,
          validity: pkg.duration,
        });
        await this.prisma.order.update({ where: { id: order.id }, data: { waSent: true } });
      }
      const bal = await this.wallet.balanceFor('AGENT', agentId);
      return { reference: merchantRef, status: 'COMPLETED', voucher, balance: bal };
    }

    // FAILURE → release hold (refund), mark order FAILED (BR-25)
    await this.wallet.release(hold.id);
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'FAILED', fulfillError: result.error ?? 'provisioning failed' },
    });
    throw new BadRequestException(`Provisioning failed: ${result.error ?? 'unknown'} (wallet not charged)`);
  }

  // ───────────────── Customer top-up (QRIS → customer wallet credit) ─────────────────
  async createCustomerTopup(customerId: number, amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException('amount invalid');
    await this.wallet.ensureAccount('CUSTOMER', customerId);
    const order = await this.prisma.order.create({
      data: {
        merchantRef: generateMerchantRef(Date.now()),
        customerId,
        purpose: 'CUSTOMER_TOPUP',
        fundingSource: 'QRIS',
        customerWhatsapp: (await this.auth.customerPhone(customerId)) ?? '-',
        amount,
        originalAmount: amount,
        paymentMethod: 'QRIS',
        status: 'UNPAID',
        fulfillStatus: 'PENDING',
      },
    });
    const payment = await this.payments.createForOrder(order.id, amount);
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        reference: payment.reference,
        amount: payment.totalAmount,
        totalAmount: payment.totalAmount,
        checkoutUrl: payment.qrUrl,
        expiresAt: payment.expiresAt,
      },
    });
    return {
      reference: payment.reference,
      purpose: 'CUSTOMER_TOPUP',
      payment: {
        originalAmount: payment.originalAmount,
        totalAmount: payment.totalAmount,
        qrUrl: payment.qrUrl,
        expiresAt: payment.expiresAt,
      },
    };
  }

  // ───────────────── Customer wallet purchase (Reserve→Settle/Release saga) ─────────────────
  async customerWalletPurchase(customerId: number, packageId: number) {
    const pkg = await this.catalog.getPackage(packageId);
    if (!pkg.isActive) throw new BadRequestException('Package is not active');
    const creds = await this.voucherCredsForServer(pkg.serverId ?? null);
    const phone = await this.auth.customerPhone(customerId);
    if (!phone) throw new NotFoundException('Customer not found');

    const price = pkg.price; // customers pay retail (no agent discount)
    const account = await this.wallet.ensureAccount('CUSTOMER', customerId);
    const merchantRef = generateMerchantRef(Date.now());

    const order = await this.prisma.order.create({
      data: {
        merchantRef,
        reference: merchantRef,
        packageId: pkg.id,
        serverId: pkg.serverId ?? null,
        customerId,
        purpose: 'VOUCHER',
        fundingSource: 'WALLET',
        qty: 1,
        customerWhatsapp: phone,
        amount: price,
        originalAmount: price,
        paymentMethod: 'WALLET',
        status: 'UNPAID',
        fulfillStatus: 'PENDING',
        voucherUsername: creds.username,
        voucherPassword: creds.password,
      },
    });

    const hold = await this.wallet.reserve(account.id, price, merchantRef, WALLET_HOLD_TTL_MS);
    await this.prisma.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date() } });

    const full = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { package: { select: { mikrotikProfile: true, duration: true, name: true } } },
    });
    const result = await this.provisioning.provisionOrder(full);

    if (result.status === 'created' || result.status === 'already_done') {
      await this.wallet.settle(hold.id, `Voucher ${pkg.name}`);
      const voucher = await this.prisma.voucher.findFirst({ where: { orderId: order.id } });
      if (voucher) {
        await this.notifications.sendVoucher({
          to: phone,
          packageName: pkg.name,
          username: voucher.username,
          password: voucher.password,
          validity: pkg.duration,
        });
        await this.prisma.order.update({ where: { id: order.id }, data: { waSent: true } });
      }
      const bal = await this.wallet.balanceFor('CUSTOMER', customerId);
      return { reference: merchantRef, status: 'COMPLETED', voucher, balance: bal };
    }

    await this.wallet.release(hold.id);
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'FAILED', fulfillError: result.error ?? 'provisioning failed' },
    });
    throw new BadRequestException(`Provisioning failed: ${result.error ?? 'unknown'} (wallet not charged)`);
  }

  // ───────────────── Customer QRIS direct purchase (pay QR → voucher to inbox) ─────────────────
  // Like MyTelkomsel "beli langsung bayar QRIS" (no balance needed). On payment the
  // confirmPayment path provisions and the voucher lands in this customer's inbox.
  async customerQrisPurchase(customerId: number, packageId: number) {
    const pkg = await this.catalog.getPackage(packageId);
    if (!pkg.isActive) throw new BadRequestException('Package is not active');
    const creds = await this.voucherCredsForServer(pkg.serverId ?? null);
    const phone = await this.auth.customerPhone(customerId);
    if (!phone) throw new NotFoundException('Customer not found');

    const order = await this.prisma.order.create({
      data: {
        merchantRef: generateMerchantRef(Date.now()),
        packageId: pkg.id,
        serverId: pkg.serverId ?? null,
        customerId,
        purpose: 'VOUCHER',
        fundingSource: 'QRIS',
        qty: 1,
        customerWhatsapp: phone,
        amount: pkg.price,
        originalAmount: pkg.price,
        paymentMethod: 'QRIS',
        status: 'UNPAID',
        fulfillStatus: 'PENDING',
        voucherUsername: creds.username,
        voucherPassword: creds.password,
      },
    });
    const payment = await this.payments.createForOrder(order.id, pkg.price);
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        reference: payment.reference,
        amount: payment.totalAmount,
        totalAmount: payment.totalAmount,
        checkoutUrl: payment.qrUrl,
        expiresAt: payment.expiresAt,
      },
    });
    return {
      reference: payment.reference,
      status: 'UNPAID',
      package: { id: pkg.id, name: pkg.name },
      payment: {
        originalAmount: payment.originalAmount,
        totalAmount: payment.totalAmount,
        qrUrl: payment.qrUrl,
        expiresAt: payment.expiresAt,
      },
    };
  }

  /**
   * Resolve a customer by a free-form handle: username → phone (normalised to 62…)
   * → legacy numeric id. Most customers register with a PHONE only (username
   * optional), so both are accepted. Returns null when nothing matches.
   */
  private async resolveCustomerByHandle(handleRaw?: string, customerId?: number) {
    const handle = (handleRaw ?? '').trim();
    let customer = handle
      ? await this.prisma.customer.findUnique({ where: { username: handle.toLowerCase() } })
      : null;
    if (!customer && handle) {
      let digits = handle.replace(/\D/g, '');
      if (digits.startsWith('0')) digits = '62' + digits.slice(1);
      else if (!digits.startsWith('62') && digits.length >= 9 && digits.length <= 12) digits = '62' + digits;
      if (digits.length >= 8) {
        customer = await this.prisma.customer.findUnique({ where: { phone: digits } });
      }
    }
    if (!customer && customerId) {
      customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    }
    return customer;
  }

  /** Read-only customer detection for the agent "jual" screen — confirms the
   *  recipient exists before selling. Returns a masked summary (never secrets). */
  async agentLookupCustomer(_agentId: number, handle: string) {
    const c = await this.resolveCustomerByHandle(handle);
    if (!c) return { found: false as const };
    const phone = c.phone ?? '';
    const maskedPhone = phone.length >= 5 ? phone.slice(0, 4) + '****' + phone.slice(-3) : phone;
    return {
      found: true as const,
      id: c.id,
      name: c.name ?? null,
      username: c.username ?? null,
      phone: maskedPhone,
    };
  }

  // ───────────────── Agent sells a voucher INTO a customer's account (inbox) ─────────────────
  // Agent enters the customer's account id; agent's wallet is charged; the voucher is
  // delivered into that customer's inbox. (Customer pays the agent offline.)
  async agentSellToCustomer(
    agentId: number,
    target: { username?: string; customerId?: number },
    packageId: number,
    pin?: string,
  ) {
    const pkg = await this.catalog.getPackage(packageId);
    if (!pkg.isActive) throw new BadRequestException('Package is not active');
    const creds = await this.voucherCredsForServer(pkg.serverId ?? null);
    await this.assertAgentMaySell(agentId, pkg.serverId);

    // Resolve the destination account by handle: username → phone → legacy id.
    const customer = await this.resolveCustomerByHandle(target.username, target.customerId);
    if (!customer) {
      throw new NotFoundException('Akun pelanggan tidak ditemukan (cek username atau No. HP)');
    }
    const customerId = customer.id;

    const pinOk = await this.auth.verifyPin(agentId, pin ?? '');
    if (!pinOk) throw new ForbiddenException('PIN required/invalid');

    const seller = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { discountPercent: true },
    });
    const price = this.agentPriceFor(pkg, seller?.discountPercent);
    const account = await this.wallet.ensureAccount('AGENT', agentId);
    const merchantRef = generateMerchantRef(Date.now());

    const order = await this.prisma.order.create({
      data: {
        merchantRef,
        reference: merchantRef,
        packageId: pkg.id,
        serverId: pkg.serverId ?? null,
        agentId,
        customerId, // → voucher lands in this customer's inbox
        purpose: 'VOUCHER',
        fundingSource: 'WALLET',
        qty: 1,
        customerWhatsapp: customer.phone,
        amount: price,
        originalAmount: price,
        paymentMethod: 'WALLET',
        status: 'UNPAID',
        fulfillStatus: 'PENDING',
        voucherUsername: creds.username,
        voucherPassword: creds.password,
      },
    });

    const hold = await this.wallet.reserve(account.id, price, merchantRef, WALLET_HOLD_TTL_MS);
    await this.prisma.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date() } });

    const full = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { package: { select: { mikrotikProfile: true, duration: true, name: true } } },
    });
    const result = await this.provisioning.provisionOrder(full);

    if (result.status === 'created' || result.status === 'already_done') {
      // Show the buyer by their account username (fallback name/phone), not the numeric id, and include the code.
      const buyerLabel = customer.username || customer.name || customer.phone || `#${customerId}`;
      await this.wallet.settle(hold.id, `Voucher ${pkg.name} • Kode ${creds.username} → ${buyerLabel}`);
      const voucher = await this.prisma.voucher.findFirst({ where: { orderId: order.id } });
      const bal = await this.wallet.balanceFor('AGENT', agentId);
      return { reference: merchantRef, status: 'COMPLETED', deliveredTo: customerId, voucher, agentBalance: bal };
    }

    await this.wallet.release(hold.id);
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'FAILED', fulfillError: result.error ?? 'provisioning failed' },
    });
    throw new BadRequestException(`Provisioning failed: ${result.error ?? 'unknown'} (agent wallet not charged)`);
  }

  // ───────────────── Cart / Batch sell ─────────────────

  async agentSellBatch(
    agentId: number,
    dto: {
      items: { packageId: number; qty: number }[];
      username?: string;
      customerWhatsapp?: string;
      pin?: string;
    },
  ) {
    if (!dto.items?.length) throw new BadRequestException('Keranjang kosong');
    const results: unknown[] = [];
    for (const item of dto.items) {
      const qty = Math.max(1, Math.min(item.qty ?? 1, 20));
      for (let i = 0; i < qty; i++) {
        if (dto.username) {
          const r = await this.agentSellToCustomer(
            agentId,
            { username: dto.username },
            item.packageId,
            dto.pin,
          );
          results.push(r);
        } else {
          const r = await this.agentWalletPurchase(
            agentId,
            item.packageId,
            dto.customerWhatsapp ?? '-',
            dto.pin,
          );
          results.push(r);
        }
      }
    }
    return { count: results.length, results };
  }

  // ───────────────── Contacts ─────────────────

  async listContacts(agentId: number) {
    return this.prisma.agentContact.findMany({
      where: { agentId },
      orderBy: { name: 'asc' },
    });
  }

  async createContact(agentId: number, dto: { name: string; username?: string; phone?: string; note?: string }) {
    return this.prisma.agentContact.create({
      data: { agentId, name: dto.name.trim(), username: dto.username?.trim() || null, phone: dto.phone?.trim() || null, note: dto.note?.trim() || null },
    });
  }

  async updateContact(agentId: number, id: number, dto: { name?: string; username?: string; phone?: string; note?: string }) {
    const contact = await this.prisma.agentContact.findUnique({ where: { id } });
    if (!contact || contact.agentId !== agentId) throw new NotFoundException('Kontak tidak ditemukan');
    return this.prisma.agentContact.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.username !== undefined ? { username: dto.username.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
      },
    });
  }

  async deleteContact(agentId: number, id: number) {
    const contact = await this.prisma.agentContact.findUnique({ where: { id } });
    if (!contact || contact.agentId !== agentId) throw new NotFoundException('Kontak tidak ditemukan');
    await this.prisma.agentContact.delete({ where: { id } });
    return { deleted: true };
  }

  // ───────────────── Activation (first login) ─────────────────
  /**
   * Activate a voucher on its FIRST login at the router. Idempotent: only the first
   * call sets activatedAt + expiryDate (= login time + package duration); subsequent
   * calls are no-ops (validity never restarts). Invoked by the hotspot on-login
   * webhook. The router profile enforces the real cutoff; this tracks it for display.
   */
  async activateVoucherOnLogin(username: string, loginAt: Date = new Date()) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { username },
      include: { order: { select: { package: { select: { duration: true } } } } },
    });
    if (!voucher) return { found: false as const };
    if (voucher.activatedAt) {
      return {
        found: true as const,
        alreadyActive: true,
        activatedAt: voucher.activatedAt,
        expiryDate: voucher.expiryDate,
      };
    }
    const duration = voucher.order?.package?.duration ?? '1d';
    const expiry = ProvisioningService.addDuration(duration, loginAt);
    const updated = await this.prisma.voucher.update({
      where: { id: voucher.id },
      data: { activatedAt: loginAt, expiryDate: expiry },
      select: { activatedAt: true, expiryDate: true },
    });
    return { found: true as const, alreadyActive: false, ...updated };
  }

  // ───────────────── Customer voucher inbox ─────────────────
  async listCustomerVouchers(customerId: number) {
    const rows = await this.prisma.voucher.findMany({
      where: { customerId },
      orderBy: { id: 'desc' },
      include: {
        order: { select: { merchantRef: true, paymentMethod: true, createdAt: true, package: { select: { name: true, duration: true } } } },
      },
    });
    return rows.map((v) => ({
      id: v.id,
      username: v.username,
      password: v.password,
      profile: v.profile,
      activatedAt: v.activatedAt,
      expiryDate: v.expiryDate,
      // NOT_ACTIVATED until first login; then ACTIVE / EXPIRED by wall-clock.
      validityStatus: v.activatedAt
        ? v.expiryDate && v.expiryDate.getTime() < Date.now()
          ? 'EXPIRED'
          : 'ACTIVE'
        : 'NOT_ACTIVATED',
      isActive: v.isActive,
      createdAt: v.createdAt,
      package: v.order.package ? { name: v.order.package.name, duration: v.order.package.duration } : null,
      paymentMethod: v.order.paymentMethod,
    }));
  }

  // ───────────────── Status query ─────────────────
  async getByReference(reference: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ reference }, { merchantRef: reference }] },
      include: {
        vouchers: { select: { username: true, password: true, profile: true, activatedAt: true, expiryDate: true } },
        package: { select: { id: true, name: true, duration: true } },
        payment: { select: { totalAmount: true, status: true, expiresAt: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return {
      reference: order.reference,
      merchantRef: order.merchantRef,
      status: order.status,
      fulfillStatus: order.fulfillStatus,
      purpose: order.purpose,
      fundingSource: order.fundingSource,
      amount: order.amount,
      customerWhatsapp: order.customerWhatsapp,
      package: order.package,
      payment: order.payment,
      vouchers: order.vouchers,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    };
  }

  // ───────────────── Payment confirmation (webhook/sim) ─────────────────
  async confirmPayment(reference: string) {
    const orderId = await this.payments.markPaidByReference(reference);
    if (orderId === null) {
      this.logger.warn(`Webhook for unknown payment reference: ${reference}`);
      return { status: 'unknown_reference' as const };
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { package: { select: { mikrotikProfile: true, duration: true, name: true } } },
    });
    if (!order) return { status: 'order_not_found' as const };

    if (order.status !== 'PAID') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: order.paidAt ?? new Date() },
      });
      order.status = 'PAID';
    }

    // Dispatch by purpose (mirrors fulfill_voucher dispatch)
    if (order.purpose === 'AGENT_TOPUP' || order.purpose === 'CUSTOMER_TOPUP') {
      const isAgent = order.purpose === 'AGENT_TOPUP';
      const ownerId = isAgent ? order.agentId : order.customerId;
      if (!ownerId) return { status: 'topup_no_owner' as const };
      const account = await this.wallet.ensureAccount(isAgent ? 'AGENT' : 'CUSTOMER', ownerId);
      await this.wallet.credit(
        account.id,
        order.originalAmount ?? order.amount,
        'TOPUP',
        order.reference ?? order.merchantRef,
        'Wallet top-up',
      ); // BR-26 (idempotent)
      return { status: 'topup_credited' as const, reference };
    }

    // Voucher provisioning (retail QRIS)
    const result = await this.provisioning.provisionOrder(order);
    if ((result.status === 'created' || result.status === 'already_done') && !order.waSent) {
      const voucher = await this.prisma.voucher.findFirst({ where: { orderId: order.id } });
      if (voucher && order.customerWhatsapp && order.customerWhatsapp !== '-') {
        const ok = await this.notifications.sendVoucher({
          to: order.customerWhatsapp,
          packageName: order.package?.name ?? 'Voucher',
          username: voucher.username,
          password: voucher.password,
          validity: order.package?.duration ?? null,
        });
        if (ok) await this.prisma.order.update({ where: { id: order.id }, data: { waSent: true } });
      }
    }
    return { status: result.status, reference };
  }
}
