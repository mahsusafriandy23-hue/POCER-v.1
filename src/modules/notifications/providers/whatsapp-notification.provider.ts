import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  SendMessageInput,
  SendResult,
} from '../notification-provider.interface';

/**
 * Real WhatsApp adapter (ACL). Posts to a Baileys-style gateway compatible with
 * the legacy WA service contract: POST {gateway}/api/send-message {chatId, text}
 * (see VOUCHER_ENGINE.md §8). The gateway URL is configurable so this can point at
 * a mock (tests), a staging gateway, or — only with explicit operator setup — a real one.
 * Nothing here hard-codes a production endpoint.
 */
@Injectable()
export class WhatsAppNotificationProvider implements NotificationProvider {
  readonly name = 'whatsapp';
  private readonly logger = new Logger('Notify:whatsapp');
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('NOTIFICATION_GATEWAY_URL', '') || '').replace(/\/+$/, '');
    this.apiKey = config.get<string>('NOTIFICATION_GATEWAY_KEY') || undefined;
    this.timeoutMs = Number(config.get('NOTIFICATION_GATEWAY_TIMEOUT_MS', 8000)) || 8000;
  }

  async send(input: SendMessageInput): Promise<SendResult> {
    if (!this.baseUrl) {
      return { ok: false, error: 'NOTIFICATION_GATEWAY_URL not configured' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['X-API-Key'] = this.apiKey;

      const res = await fetch(`${this.baseUrl}/api/send-message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ chatId: input.to, text: input.text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`gateway HTTP ${res.status} for ${input.to}`);
        return { ok: false, error: `gateway HTTP ${res.status}` };
      }
      // Tolerant of gateways that return {success:true} or a bare 200.
      const body = await res.json().catch(() => ({}));
      const ok = body?.success !== false;
      if (!ok) return { ok: false, error: body?.message ?? 'gateway reported failure' };
      this.logger.log(`sent to ${input.to}`);
      return { ok: true };
    } catch (e: any) {
      const reason = e?.name === 'AbortError' ? 'timeout' : (e?.message ?? 'network error');
      this.logger.error(`send failed to ${input.to}: ${reason}`);
      return { ok: false, error: reason };
    } finally {
      clearTimeout(timer);
    }
  }
}
