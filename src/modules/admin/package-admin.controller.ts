import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { PackageAdminService } from './package-admin.service';
import { UpdatePackageDto } from './dto/package.dto';

@Controller('platform/packages')
@UseGuards(AdminKeyGuard)
export class PackageAdminController {
  constructor(private readonly packages: PackageAdminService) {}

  @Get()
  list(@Query('server') serverId?: string) {
    return this.packages.list(serverId ? Number(serverId) : undefined);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePackageDto) {
    return this.packages.update(id, dto);
  }
}
