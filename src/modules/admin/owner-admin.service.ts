import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashSecret } from '../../common/util/password';
import { CreateOwnerDto, UpdateOwnerDto } from './dto/owner.dto';

/**
 * Platform-level management of Owner (admin) accounts and outlet assignment.
 * Guarded by the shared X-Admin-Key (platform operator). Owners themselves use
 * a JWT (actor=admin) for the day-to-day owner console.
 */
@Injectable()
export class OwnerAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Guard: the acting admin must be the platform OPERATOR. */
  async assertOperator(adminId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { isOperator: true },
    });
    if (!admin?.isOperator) {
      throw new ForbiddenException('Khusus operator');
    }
  }

  /** All outlets across the platform — for the operator's outlet-assignment picker. */
  async allOutlets() {
    const rows = await this.prisma.server.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true, isActive: true, ownerAdminId: true },
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      isActive: s.isActive,
      ownerAdminId: s.ownerAdminId,
    }));
  }

  /** One provider with its outlets + agents (operator drill-in). */
  async detail(id: number) {
    const a = await this.prisma.admin.findUnique({
      where: { id },
      include: {
        _count: { select: { agents: true, outlets: true } },
        outlets: { select: { id: true, code: true, name: true, isActive: true }, orderBy: { sortOrder: 'asc' } },
        agents: {
          select: { id: true, name: true, username: true, phone: true, status: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!a) throw new NotFoundException('Penyedia layanan tidak ditemukan');
    return {
      id: a.id,
      name: a.name,
      brandName: a.brandName,
      username: a.username,
      phone: a.phone,
      status: a.status,
      isOperator: a.isOperator,
      manageAllOutlets: a.manageAllOutlets,
      agentCount: a._count.agents,
      outletCount: a._count.outlets,
      outlets: a.outlets,
      agents: a.agents,
      createdAt: a.createdAt,
    };
  }

  async list() {
    const rows = await this.prisma.admin.findMany({
      orderBy: { id: 'asc' },
      include: {
        _count: { select: { agents: true, outlets: true } },
        outlets: { select: { id: true, code: true, name: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      brandName: a.brandName,
      username: a.username,
      phone: a.phone,
      status: a.status,
      isOperator: a.isOperator,
      manageAllOutlets: a.manageAllOutlets,
      agentCount: a._count.agents,
      outletCount: a._count.outlets,
      outlets: a.outlets,
      createdAt: a.createdAt,
    }));
  }

  async create(dto: CreateOwnerDto) {
    const username = dto.username.trim().toLowerCase();
    const phone = dto.phone?.trim() || null;
    const exists = await this.prisma.admin.findFirst({
      where: { OR: [{ username }, ...(phone ? [{ phone }] : [])] },
    });
    if (exists) {
      throw new BadRequestException(
        exists.username === username ? 'Username sudah dipakai' : 'Nomor sudah terdaftar',
      );
    }
    const admin = await this.prisma.admin.create({
      data: {
        name: dto.name,
        brandName: dto.brandName?.trim() || null,
        username,
        phone,
        passwordHash: hashSecret(dto.password),
        pinHash: dto.pin ? hashSecret(dto.pin) : null,
        status: 'ACTIVE',
        manageAllOutlets: dto.manageAllOutlets ?? false,
      },
      select: { id: true, name: true, brandName: true, username: true, phone: true, status: true, manageAllOutlets: true },
    });
    return admin;
  }

  async update(id: number, dto: UpdateOwnerDto) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Owner tidak ditemukan');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.brandName !== undefined) data.brandName = dto.brandName.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.password !== undefined) data.passwordHash = hashSecret(dto.password);
    if (dto.pin !== undefined) data.pinHash = dto.pin ? hashSecret(dto.pin) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.manageAllOutlets !== undefined) data.manageAllOutlets = dto.manageAllOutlets;
    const updated = await this.prisma.admin.update({
      where: { id },
      data,
      select: { id: true, name: true, username: true, phone: true, status: true, manageAllOutlets: true },
    });
    return updated;
  }

  /** Replace the full set of outlets this owner manages. */
  async assignOutlets(id: number, serverIds: number[]) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Owner tidak ditemukan');
    if (serverIds.length) {
      const found = await this.prisma.server.count({ where: { id: { in: serverIds } } });
      if (found !== serverIds.length) throw new BadRequestException('Sebagian outlet tidak ditemukan');
    }
    await this.prisma.$transaction([
      // Release outlets previously owned by this admin but no longer in the set.
      this.prisma.server.updateMany({
        where: { ownerAdminId: id, id: { notIn: serverIds.length ? serverIds : [-1] } },
        data: { ownerAdminId: null },
      }),
      // Claim the requested outlets for this admin.
      this.prisma.server.updateMany({
        where: { id: { in: serverIds.length ? serverIds : [-1] } },
        data: { ownerAdminId: id },
      }),
    ]);
    const outlets = await this.prisma.server.findMany({
      where: { ownerAdminId: id },
      select: { id: true, code: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
    return { ownerId: id, outlets };
  }
}
