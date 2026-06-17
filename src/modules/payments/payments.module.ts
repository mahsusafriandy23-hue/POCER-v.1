import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GobizModule } from './gobiz/gobiz.module';
import { BriModule } from './bri/bri.module';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { PAYMENT_DETECTION } from './payment-detection.interface';
import { SimPaymentProvider } from './providers/sim-payment.provider';
import { GobizPaymentProvider } from './providers/gobiz-payment.provider';
import { BriPaymentProvider } from './providers/bri-payment.provider';
import { SimDetectionProvider } from './providers/sim-detection.provider';
import { GobizDetectionProvider } from './providers/gobiz-detection.provider';

@Module({
  imports: [GobizModule, BriModule],
  providers: [
    PaymentsService,
    SimPaymentProvider,
    GobizPaymentProvider,
    BriPaymentProvider,
    SimDetectionProvider,
    GobizDetectionProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, SimPaymentProvider, GobizPaymentProvider],
      useFactory: (config: ConfigService, sim: SimPaymentProvider, gobiz: GobizPaymentProvider) => {
        switch (config.get<string>('PAYMENT_PROVIDER', 'sim')) {
          case 'gobiz':
            return gobiz;
          default:
            return sim;
        }
      },
    },
    {
      provide: PAYMENT_DETECTION,
      inject: [ConfigService, SimDetectionProvider, GobizDetectionProvider],
      useFactory: (config: ConfigService, sim: SimDetectionProvider, gobiz: GobizDetectionProvider) => {
        switch (config.get<string>('DETECTION_PROVIDER', 'sim')) {
          case 'gobiz':
            return gobiz;
          default:
            return sim;
        }
      },
    },
  ],
  exports: [PaymentsService, PAYMENT_DETECTION, SimDetectionProvider, BriModule],
})
export class PaymentsModule {}
