import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashSecret, verifySecret } from '../../common/util/password';
import { normalizeWhatsapp } from '../../common/util/codes';
import { RegisterAgentDto, LoginDto } from './dto/auth.dto';
import { LoginThrottleService } from './login-throttle.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly throttle: LoginThrottleService,
  ) {}

  /** Build throttle keys for a login attempt (per IP + per actor:identifier). */
  private throttleKeys(actor: string, login: string, ip?: string): string[] {
    const id = login.trim().toLowerCase();
    return [`ip:${actor}:${ip ?? 'unknown'}`, `id:${actor}:${id}`];
  }

  async register(dto: RegisterAgentDto) {
    const phone = normalizeWhatsapp(dto.phone);
    if (!phone) throw new BadRequestException('Invalid phone');
    const exists = await this.prisma.agent.findFirst({
      where: { OR: [{ phone }, ...(dto.username ? [{ username: dto.username }] : [])] },
    });
    if (exists) throw new BadRequestException('Agent already exists (phone/username)');

    const brand = await this.resolveBrand(dto.providerId);
    const agent = await this.prisma.agent.create({
      data: {
        name: dto.name,
        phone,
        username: dto.username ?? null,
        passwordHash: hashSecret(dto.password),
        pinHash: dto.pin ? hashSecret(dto.pin) : null,
        status: 'ACTIVE',
        adminId: brand?.ownerAdminId ?? null,
        brandId: brand?.brandId ?? null,
      },
      select: { id: true, name: true, phone: true, username: true, status: true },
    });
    return { agent, ...this.issueToken(agent.id, 'agent') };
  }

  async login(dto: LoginDto, ip?: string) {
    const login = dto.login.trim();
    const keys = this.throttleKeys('agent', login, ip);
    this.throttle.assertAllowed(keys);
    const byPhone = normalizeWhatsapp(login);
    const agent = await this.prisma.agent.findFirst({
      where: { OR: [{ username: login }, ...(byPhone ? [{ phone: byPhone }] : [])] },
    });
    if (!agent || !verifySecret(dto.password, agent.passwordHash)) {
      this.throttle.recordFailure(keys);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (agent.status !== 'ACTIVE') throw new UnauthorizedException('Agent not active');
    this.throttle.recordSuccess(keys);
    return {
      agent: { id: agent.id, name: agent.name, phone: agent.phone, username: agent.username },
      ...this.issueToken(agent.id, 'agent'),
    };
  }

  /** Verify an agent's PIN for spend step-up (BR-28). */
  async verifyPin(agentId: number, pin: string): Promise<boolean> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return false;
    if (!agent.pinHash) return true; // no PIN set → not required (mirrors legacy)
    return verifySecret(pin, agent.pinHash);
  }

  // ── Customer identity (mobile ecosystem) ──
  async registerCustomer(dto: {
    name?: string;
    username: string;
    phone: string;
    password: string;
    providerId?: number;
  }) {
    const phone = normalizeWhatsapp(dto.phone);
    if (!phone) throw new BadRequestException('Invalid phone');
    const username = dto.username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,20}$/.test(username)) throw new BadRequestException('Username tidak valid');
    const brand = await this.resolveBrand(dto.providerId);
    const exists = await this.prisma.customer.findFirst({
      where: { OR: [{ phone }, { username }] },
    });
    if (exists) {
      throw new BadRequestException(
        exists.username === username ? 'Username sudah dipakai' : 'Nomor sudah terdaftar',
      );
    }
    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name ?? null,
        username,
        phone,
        passwordHash: hashSecret(dto.password),
        status: 'ACTIVE',
        brandId: brand?.brandId ?? null,
        providerAdminId: brand?.ownerAdminId ?? null,
      },
      select: { id: true, name: true, username: true, phone: true, status: true, providerAdminId: true },
    });
    return { customer, ...this.issueToken(customer.id, 'customer') };
  }

  /** Public list of BRANDS for the signup dropdown (a customer belongs to a brand).
   *  The `providerId` clients send back is a brand id. */
  async listProviders() {
    const brands = await this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });
    return { providers: brands.map((b) => ({ id: b.id, name: b.name })) };
  }

  /** Validate an optional brand id points to an ACTIVE brand; returns the brand +
   *  its owning admin (kept on the customer for back-compat), or null. */
  private async resolveBrand(
    brandId?: number,
  ): Promise<{ brandId: number; ownerAdminId: number } | null> {
    if (brandId === undefined || brandId === null) return null;
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, isActive: true },
      select: { id: true, ownerAdminId: true },
    });
    if (!brand) throw new BadRequestException('Brand tidak ditemukan');
    return { brandId: brand.id, ownerAdminId: brand.ownerAdminId };
  }

  /** Customer profile incl. current provider (for the "Akun saya" page). */
  async customerMe(customerId: number) {
    const c = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        status: true,
        brand: { select: { id: true, name: true } },
      },
    });
    if (!c) throw new UnauthorizedException('Customer not found');
    const provider = c.brand ? { id: c.brand.id, name: c.brand.name } : null;
    return { ...c, provider };
  }

  /** Change the customer's BRAND (the `providerId` sent is a brand id). */
  async setCustomerProvider(customerId: number, providerId: number) {
    const brand = await this.resolveBrand(providerId);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { brandId: brand?.brandId ?? null, providerAdminId: brand?.ownerAdminId ?? null },
    });
    return this.customerMe(customerId);
  }

  async loginCustomer(dto: { login: string; password: string }, ip?: string) {
    const login = dto.login.trim();
    const keys = this.throttleKeys('customer', login, ip);
    this.throttle.assertAllowed(keys);
    const phone = normalizeWhatsapp(login);
    const username = login.toLowerCase();
    // Login by username OR phone (whichever matches).
    const customer = await this.prisma.customer.findFirst({
      where: { OR: [{ username }, ...(phone ? [{ phone }] : [])] },
    });
    if (!customer || !verifySecret(dto.password, customer.passwordHash)) {
      this.throttle.recordFailure(keys);
      throw new UnauthorizedException('Username/nomor atau kata sandi salah');
    }
    if (customer.status !== 'ACTIVE') throw new UnauthorizedException('Customer not active');
    this.throttle.recordSuccess(keys);
    return {
      customer: { id: customer.id, name: customer.name, username: customer.username, phone: customer.phone },
      ...this.issueToken(customer.id, 'customer'),
    };
  }

  /** Resolve a customer's phone (delivery target). */
  async customerPhone(customerId: number): Promise<string | null> {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } });
    return c?.phone ?? null;
  }

  // ── Admin / Owner identity ──
  /** Owner login by username OR phone. Returns an admin JWT (actor=admin). */
  async loginAdmin(dto: { login: string; password: string }, ip?: string) {
    const login = dto.login.trim();
    const keys = this.throttleKeys('admin', login, ip);
    this.throttle.assertAllowed(keys);
    const byPhone = normalizeWhatsapp(login);
    const admin = await this.prisma.admin.findFirst({
      where: { OR: [{ username: login.toLowerCase() }, ...(byPhone ? [{ phone: byPhone }] : [])] },
    });
    if (!admin || !verifySecret(dto.password, admin.passwordHash)) {
      this.throttle.recordFailure(keys);
      throw new UnauthorizedException('Username/nomor atau kata sandi salah');
    }
    if (admin.status !== 'ACTIVE') throw new UnauthorizedException('Akun admin tidak aktif');
    this.throttle.recordSuccess(keys);
    return {
      admin: { id: admin.id, name: admin.name, username: admin.username, phone: admin.phone },
      ...this.issueToken(admin.id, 'admin'),
    };
  }

  /** Assistant login (limited monitoring user). Returns an assistant JWT. */
  async loginAssistant(dto: { login: string; password: string }, ip?: string) {
    const login = dto.login.trim();
    const keys = this.throttleKeys('assistant', login, ip);
    this.throttle.assertAllowed(keys);
    const assistant = await this.prisma.assistant.findFirst({
      where: { username: login.toLowerCase() },
    });
    if (!assistant || !verifySecret(dto.password, assistant.passwordHash)) {
      this.throttle.recordFailure(keys);
      throw new UnauthorizedException('Username atau kata sandi salah');
    }
    if (assistant.status !== 'ACTIVE') throw new UnauthorizedException('Akun asisten tidak aktif');
    this.throttle.recordSuccess(keys);
    return {
      assistant: { id: assistant.id, name: assistant.name, username: assistant.username },
      ...this.issueToken(assistant.id, 'assistant'),
    };
  }

  private issueToken(sub: number, actor: 'agent' | 'customer' | 'admin' | 'assistant') {
    const accessToken = this.jwt.sign({ sub, actor });
    return { accessToken, tokenType: 'Bearer' as const };
  }
}
