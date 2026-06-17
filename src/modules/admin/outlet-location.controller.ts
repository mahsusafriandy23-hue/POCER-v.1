import {
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateOutletLocationDto } from './dto/outlet-location.dto';

/**
 * Admin: set an outlet's geolocation (map point + coverage radius) used by the
 * storefront's "nearest outlet" auto-selection. The map-pin / "use my location"
 * UI is provided by the internal admin app; this is the backing endpoint.
 */
@Controller('platform/outlets')
@UseGuards(AdminKeyGuard)
export class OutletLocationController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch(':id/location')
  async setLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOutletLocationDto,
  ) {
    const exists = await this.prisma.server.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException(`Outlet ${id} not found`);
    return this.prisma.server.update({
      where: { id },
      data: {
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.serviceRadiusKm !== undefined ? { serviceRadiusKm: dto.serviceRadiusKm } : {}),
      },
      select: { id: true, code: true, name: true, latitude: true, longitude: true, serviceRadiusKm: true },
    });
  }
}
