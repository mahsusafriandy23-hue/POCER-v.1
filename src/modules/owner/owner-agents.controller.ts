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
import { OwnerAgentsService } from './owner-agents.service';
import {
  CreateAgentDto,
  UpdateAgentDto,
  AssignAgentOutletsDto,
  AgentTopupDto,
} from './dto/owner.dto';

/** Owner-scoped agent management. */
@Controller('admin/agents')
@UseGuards(JwtAuthGuard)
export class OwnerAgentsController {
  constructor(private readonly agents: OwnerAgentsService) {}

  @Get()
  list(@CurrentAdmin() adminId: number) {
    return this.agents.list(adminId);
  }

  @Post()
  create(@CurrentAdmin() adminId: number, @Body() dto: CreateAgentDto) {
    return this.agents.create(adminId, dto);
  }

  @Get(':id')
  get(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.agents.get(adminId, id);
  }

  @Patch(':id')
  update(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.agents.update(adminId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.agents.remove(adminId, id);
  }

  @Post(':id/outlets')
  assignOutlets(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAgentOutletsDto,
  ) {
    return this.agents.assignOutlets(adminId, id, dto.serverIds);
  }

  @Post(':id/topup')
  topup(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AgentTopupDto,
  ) {
    return this.agents.topup(adminId, id, dto.amount, dto.note);
  }
}
