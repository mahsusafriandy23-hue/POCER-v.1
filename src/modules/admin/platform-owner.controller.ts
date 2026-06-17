import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { OwnerAdminService } from './owner-admin.service';
import { CreateOwnerDto, UpdateOwnerDto, AssignOutletsDto } from './dto/owner.dto';

/** Platform operator (X-Admin-Key): manage Owner accounts + assign outlets to them. */
@Controller('platform/owners')
@UseGuards(AdminKeyGuard)
export class PlatformOwnerController {
  constructor(private readonly owners: OwnerAdminService) {}

  @Get()
  list() {
    return this.owners.list();
  }

  @Post()
  create(@Body() dto: CreateOwnerDto) {
    return this.owners.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOwnerDto) {
    return this.owners.update(id, dto);
  }

  @Post(':id/outlets')
  assignOutlets(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignOutletsDto) {
    return this.owners.assignOutlets(id, dto.serverIds);
  }
}
