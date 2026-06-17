import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationProvider,
  SendMessageInput,
  SendResult,
} from '../notification-provider.interface';

@Injectable()
export class SimNotificationProvider implements NotificationProvider {
  readonly name = 'sim';
  private readonly logger = new Logger('Notify:sim');

  async send(input: SendMessageInput): Promise<SendResult> {
    this.logger.log(`SIM send to ${input.to}: ${input.text.replace(/\n/g, ' / ')}`);
    return { ok: true };
  }
}
