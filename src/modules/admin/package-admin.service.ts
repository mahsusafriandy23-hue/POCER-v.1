import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdatePackageDto } from './dto/package.dto';

/**
 * Admin-side package management: list all packages (active or not) and edit the
 * marketing/promo display fields the storefront renders (price, original price,
 * promo badge, bonus line, flash-sale flag, active toggle).
 */
@Injectable()
export class PackageAdminService {
  constructor(private readonly prisma: PrismaService) {}

  list(serverId?: number) {
    return this.prisma.package.findMany({
      where: serverId ? { serverId } : {},
      orderBy: [{ serverId: 'asc' }, { price: 'asc' }],
      include: { server: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: number, dto: UpdatePackageDto) {
    const exists = await this.prisma.package.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException(`Package ${id} not found`);
    return this.prisma.package.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.originalPrice !== undefined ? { originalPrice: dto.originalPrice } : {}),
        ...(dto.promoLabel !== undefined ? { promoLabel: dto.promoLabel } : {}),
        ...(dto.bonusLabel !== undefined ? { bonusLabel: dto.bonusLabel } : {}),
        ...(dto.isFlashSale !== undefined ? { isFlashSale: dto.isFlashSale } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
      include: { server: { select: { id: true, code: true, name: true } } },
    });
  }
}
