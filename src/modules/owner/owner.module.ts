import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { IdentityModule } from '../identity/identity.module';
import { GobizModule } from '../payments/gobiz/gobiz.module';
import { OwnerController } from './owner.controller';
import { OwnerAgentsController } from './owner-agents.controller';
import { OwnerService } from './owner.service';
import { OwnerAgentsService } from './owner-agents.service';

@Module({
  imports: [WalletModule, IdentityModule, GobizModule],
  providers: [OwnerService, OwnerAgentsService],
  controllers: [OwnerController, OwnerAgentsController],
})
export class OwnerModule {}
