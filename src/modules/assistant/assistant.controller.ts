import { Body, Controller, Get, Ip, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from '../identity/auth.service';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentAssistant } from '../identity/current-agent.decorator';
import { AdminLoginDto } from '../identity/dto/admin-auth.dto';
import { AssistantService } from './assistant.service';

/** Assistant (asisten) console — read-only, scoped to granted outlets. */
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly auth: AuthService,
    private readonly assistant: AssistantService,
  ) {}

  @Post('auth/login')
  login(@Body() dto: AdminLoginDto, @Ip() ip: string) {
    return this.auth.loginAssistant(dto, ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentAssistant() id: number) {
    return this.assistant.me(id);
  }

  @Get('outlets')
  @UseGuards(JwtAuthGuard)
  outlets(@CurrentAssistant() id: number) {
    return this.assistant.outlets(id);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  transactions(
    @CurrentAssistant() id: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assistant.transactions(id, {
      search,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  summary(
    @CurrentAssistant() id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.assistant.summary(id, from, to);
  }
}
