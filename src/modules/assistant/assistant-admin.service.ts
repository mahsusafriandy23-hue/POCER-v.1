import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashSecret } from '../../common/util/password';

export interface CreateAssistantInput {
  name: string;
  username: string;
  password: string;
  canSell?: boolean;
  serverIds?: number[];
}
export interface UpdateAssistantInput {
  name?: string;
  password?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  canSell?: boolean;
}

/** Operator-only management of Assistant (asisten) accounts + outlet access. */
@Injectable()
export class AssistantAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOperator(adminId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { isOperator: true },
    });
    if (!admin?.isOperator) throw new ForbiddenException('Khusus operator');
  }

  async list() {
    const rows = await this.prisma.assistant.findMany({
      orderBy: { id: 'asc' },
      include: { outlets: { include: { server: { select: { id: true, code: true, name: true } } } } },
    });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      username: a.username,
      status: a.status,
      canSell: a.canSell,
      outlets: a.outlets.map((o) => o.server),
      outletCount: a.outlets.length,
      createdAt: a.createdAt,
    }));
  }

  async detail(id: number) {
    const a = await this.prisma.assistant.findUnique({
      where: { id },
      include: { outlets: { include: { server: { select: { id: true, code: true, name: true } } } } },
    });
    if (!a) throw new NotFoundException('Asisten tidak ditemukan');
    return {
      id: a.id,
      name: a.name,
      username: a.username,
      status: a.status,
      canSell: a.canSell,
      outlets: a.outlets.map((o) => o.server),
      createdAt: a.createdAt,
    };
  }

  async create(dto: CreateAssistantInput) {
    const username = dto.username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,20}$/.test(username)) {
      throw new BadRequestException('Username 3-20 huruf kecil/angka/._');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Password minimal 6 karakter');
    }
    const clash = await this.prisma.assistant.findUnique({ where: { username } });
    if (clash) throw new BadRequestException('Username sudah dipakai');
    const a = await this.prisma.assistant.create({
      data: {
        name: dto.name.trim(),
        username,
        passwordHash: hashSecret(dto.password),
        canSell: dto.canSell ?? false,
      },
    });
    if (dto.serverIds?.length) await this.assignOutlets(a.id, dto.serverIds);
    return { id: a.id, name: a.name, username: a.username };
  }

  async update(id: number, dto: UpdateAssistantInput) {
    const a = await this.prisma.assistant.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Asisten tidak ditemukan');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.password !== undefined) data.passwordHash = hashSecret(dto.password);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.canSell !== undefined) data.canSell = dto.canSell;
    const updated = await this.prisma.assistant.update({ where: { id }, data });
    return { id: updated.id, status: updated.status, canSell: updated.canSell };
  }

  async remove(id: number) {
    const a = await this.prisma.assistant.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Asisten tidak ditemukan');
    await this.prisma.assistant.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Replace the full set of outlets this assistant can see. */
  async assignOutlets(id: number, serverIds: number[]) {
    const a = await this.prisma.assistant.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Asisten tidak ditemukan');
    if (serverIds.length) {
      const found = await this.prisma.server.count({ where: { id: { in: serverIds } } });
      if (found !== serverIds.length) throw new BadRequestException('Sebagian outlet tidak ditemukan');
    }
    await this.prisma.$transaction([
      this.prisma.assistantOutlet.deleteMany({ where: { assistantId: id } }),
      ...(serverIds.length
        ? [this.prisma.assistantOutlet.createMany({ data: serverIds.map((serverId) => ({ assistantId: id, serverId })) })]
        : []),
    ]);
    return this.detail(id);
  }

  /** All outlets on the platform — for the operator's access picker. */
  async allOutlets() {
    const rows = await this.prisma.server.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true, isActive: true, ownerAdminId: true },
    });
    return rows;
  }
}
