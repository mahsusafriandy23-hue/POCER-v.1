import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentAdmin } from '../identity/current-agent.decorator';
import {
  AssistantAdminService,
  CreateAssistantInput,
  UpdateAssistantInput,
} from './assistant-admin.service';

/** Operator-only: manage Assistant (asisten) accounts and their outlet access. */
@Controller('admin/assistants')
@UseGuards(JwtAuthGuard)
export class OperatorAssistantController {
  constructor(private readonly svc: AssistantAdminService) {}

  @Get('outlets')
  async outlets(@CurrentAdmin() adminId: number) {
    await this.svc.assertOperator(adminId);
    return this.svc.allOutlets();
  }

  @Get()
  async list(@CurrentAdmin() adminId: number) {
    await this.svc.assertOperator(adminId);
    return this.svc.list();
  }

  @Post()
  async create(@CurrentAdmin() adminId: number, @Body() dto: CreateAssistantInput) {
    await this.svc.assertOperator(adminId);
    return this.svc.create(dto);
  }

  @Get(':id')
  async detail(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    await this.svc.assertOperator(adminId);
    return this.svc.detail(id);
  }

  @Patch(':id')
  async update(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssistantInput,
  ) {
    await this.svc.assertOperator(adminId);
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  async remove(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    await this.svc.assertOperator(adminId);
    return this.svc.remove(id);
  }

  @Post(':id/outlets')
  async assignOutlets(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { serverIds: number[] },
  ) {
    await this.svc.assertOperator(adminId);
    return this.svc.assignOutlets(id, dto.serverIds ?? []);
  }
}
