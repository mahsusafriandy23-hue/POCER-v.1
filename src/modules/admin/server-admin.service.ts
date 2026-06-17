import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { CreateServerDto, UpdateServerDto } from './dto/server.dto';

@Injectable()
export class ServerAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** List servers with credentials MASKED (never return the password). */
  async list() {
    const rows = await this.prisma.server.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      mikrotikIp: s.mikrotikIp,
      mikrotikPort: s.mikrotikPort,
      mikrotikUser: s.mikrotikUser,
      hasRouterPassword: !!s.mikrotikPassEnc,
      dnsName: s.dnsName,
      isActive: s.isActive,
      sortOrder: s.sortOrder,
      ownerAdminId: s.ownerAdminId,
    }));
  }

  async create(dto: CreateServerDto) {
    const created = await this.prisma.server.create({
      data: {
        code: dto.code,
        name: dto.name,
        mikrotikIp: dto.mikrotikIp ?? null,
        mikrotikPort: dto.mikrotikPort ?? 8728,
        mikrotikUser: dto.mikrotikUser ?? null,
        mikrotikPassEnc: dto.mikrotikPass ? this.crypto.encrypt(dto.mikrotikPass) : null,
        dnsName: dto.dnsName ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return { id: created.id, code: created.code, hasRouterPassword: !!created.mikrotikPassEnc };
  }

  async update(id: number, dto: UpdateServerDto) {
    const exists = await this.prisma.server.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('server not found');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.mikrotikIp !== undefined) data.mikrotikIp = dto.mikrotikIp;
    if (dto.mikrotikPort !== undefined) data.mikrotikPort = dto.mikrotikPort;
    if (dto.mikrotikUser !== undefined) data.mikrotikUser = dto.mikrotikUser;
    if (dto.mikrotikPass !== undefined) data.mikrotikPassEnc = this.crypto.encrypt(dto.mikrotikPass);
    if (dto.dnsName !== undefined) data.dnsName = dto.dnsName;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const updated = await this.prisma.server.update({ where: { id }, data });
    return { id: updated.id, code: updated.code, hasRouterPassword: !!updated.mikrotikPassEnc };
  }
}
