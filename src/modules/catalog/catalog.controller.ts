import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('servers')
  servers() {
    return this.catalog.listServers();
  }

  @Get('packages')
  packages(
    @Query('server') serverId?: string,
    @Query('active') active?: string,
  ) {
    return this.catalog.listPackages({
      serverId: serverId ? Number(serverId) : undefined,
      activeOnly: active === 'all' ? false : true,
    });
  }

  @Get('packages/:id')
  packageDetail(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.getPackage(id);
  }

  @Get('packages/:id/price')
  price(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.effectivePrice(id);
  }
}
