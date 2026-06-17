import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AdminModule } from './modules/admin/admin.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProvisioningModule } from './modules/provisioning/provisioning.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IdentityModule } from './modules/identity/identity.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { OrderingModule } from './modules/ordering/ordering.module';
import { OwnerModule } from './modules/owner/owner.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    PrismaModule,
    CryptoModule,
    AdminModule,
    CatalogModule,
    PaymentsModule,
    ProvisioningModule,
    NotificationsModule,
    IdentityModule,
    WalletModule,
    OrderingModule,
    OwnerModule,
    AssistantModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
