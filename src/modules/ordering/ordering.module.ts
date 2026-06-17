import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';
import { IdentityModule } from '../identity/identity.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { OrderingService } from './ordering.service';
import { PaymentReconcilerService } from './payment-reconciler.service';
import { SchedulerService } from './scheduler.service';
import { OrderingController } from './ordering.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { HotspotWebhookController } from './hotspot-webhook.controller';
import { AgentController } from './agent.controller';
import { CustomerController } from './customer.controller';
import { DetectionController } from './detection.controller';
import { BriNotifyController } from './bri-notify.controller';

@Module({
  imports: [
    CatalogModule,
    PaymentsModule,
    ProvisioningModule,
    NotificationsModule,
    WalletModule,
    IdentityModule,
    CryptoModule,
  ],
  providers: [OrderingService, PaymentReconcilerService, SchedulerService],
  controllers: [
    OrderingController,
    PaymentWebhookController,
    HotspotWebhookController,
    AgentController,
    CustomerController,
    DetectionController,
    BriNotifyController,
  ],
})
export class OrderingModule {}
