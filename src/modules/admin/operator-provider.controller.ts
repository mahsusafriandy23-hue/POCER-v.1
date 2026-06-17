import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentAdmin } from '../identity/current-agent.decorator';
import { OwnerAdminService } from './owner-admin.service';
import { CreateOwnerDto, UpdateOwnerDto, AssignOutletsDto } from './dto/owner.dto';

/**
 * Operator console (JWT, actor=admin + isOperator). Lets the single platform
 * operator manage Penyedia Layanan (other providers/owners) and assign outlets
 * to them — the same capability as the X-Admin-Key platform tier, but driven by
 * the operator's own login so it can live inside the admin web app.
 */
@Controller('admin/providers')
@UseGuards(JwtAuthGuard)
export class OperatorProviderController {
  constructor(private readonly owners: OwnerAdminService) {}

  /** All outlets on the platform — for the assignment picker. Static path first. */
  @Get('outlets')
  async outlets(@CurrentAdmin() adminId: number) {
    await this.owners.assertOperator(adminId);
    return this.owners.allOutlets();
  }

  @Get()
  async list(@CurrentAdmin() adminId: number) {
    await this.owners.assertOperator(adminId);
    return this.owners.list();
  }

  @Post()
  async create(@CurrentAdmin() adminId: number, @Body() dto: CreateOwnerDto) {
    await this.owners.assertOperator(adminId);
    return this.owners.create(dto);
  }

  @Get(':id')
  async detail(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    await this.owners.assertOperator(adminId);
    return this.owners.detail(id);
  }

  @Patch(':id')
  async update(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOwnerDto,
  ) {
    await this.owners.assertOperator(adminId);
    return this.owners.update(id, dto);
  }

  @Post(':id/outlets')
  async assignOutlets(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignOutletsDto,
  ) {
    await this.owners.assertOperator(adminId);
    return this.owners.assignOutlets(id, dto.serverIds);
  }
}
