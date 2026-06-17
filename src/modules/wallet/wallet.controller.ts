import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentAgent } from '../identity/current-agent.decorator';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  balance(@CurrentAgent() agentId: number) {
    return this.wallet.balanceFor('AGENT', agentId);
  }

  @Get('transactions')
  transactions(@CurrentAgent() agentId: number, @Query('limit') limit?: string) {
    return this.wallet.ledgerFor('AGENT', agentId, limit ? Number(limit) : 50);
  }
}
