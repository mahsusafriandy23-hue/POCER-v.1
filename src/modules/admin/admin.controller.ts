import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { ServerAdminService } from './server-admin.service';
import { CreateServerDto, UpdateServerDto } from './dto/server.dto';

@Controller('platform/servers')
@UseGuards(AdminKeyGuard)
export class AdminController {
  constructor(private readonly servers: ServerAdminService) {}

  @Get()
  list() {
    return this.servers.list();
  }

  @Post()
  create(@Body() dto: CreateServerDto) {
    return this.servers.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServerDto) {
    return this.servers.update(id, dto);
  }
}
