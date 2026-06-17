import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active locations, ordered for display. */
  listServers() {
    return this.prisma.server.findMany({
      where: { isActive: true },
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

  /** Sellable packages. BR-3: storefront sees only active packages. */
  listPackages(opts: { serverId?: number; activeOnly?: boolean }) {
    const activeOnly = opts.activeOnly ?? true;
    return this.prisma.package.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(opts.serverId ? { serverId: opts.serverId } : {}),
      },
      orderBy: [{ serverId: 'asc' }, { price: 'asc' }],
      include: { server: { select: { id: true, code: true, name: true } } },
    });
  }

  async getPackage(id: number) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: { server: { select: { id: true, code: true, name: true } } },
    });
    if (!pkg) throw new NotFoundException(`Package ${id} not found`);
    return pkg;
  }

  /**
   * Effective price resolution (BR-4). Retail for now; agent pricing
   * (agent override -> package.agentPrice -> retail*(1-discount)) lands with
   * the Reseller domain in a later slice.
   */
  async effectivePrice(packageId: number): Promise<{ packageId: number; price: number; currency: string }> {
    const pkg = await this.getPackage(packageId);
    return { packageId: pkg.id, price: pkg.price, currency: 'IDR' };
  }
}
