import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_PROVIDER } from './notification-provider.interface';
import { SimNotificationProvider } from './providers/sim-notification.provider';
import { WhatsAppNotificationProvider } from './providers/whatsapp-notification.provider';

@Module({
  providers: [
    NotificationsService,
    SimNotificationProvider,
    WhatsAppNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [ConfigService, SimNotificationProvider, WhatsAppNotificationProvider],
      useFactory: (
        config: ConfigService,
        sim: SimNotificationProvider,
        whatsapp: WhatsAppNotificationProvider,
      ) => {
        const choice = config.get<string>('NOTIFICATION_PROVIDER', 'sim');
        switch (choice) {
          case 'whatsapp':
            return whatsapp;
          case 'sim':
          default:
            return sim;
        }
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
