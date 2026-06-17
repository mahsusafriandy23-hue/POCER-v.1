/**
 * Notification provider PORT (ACL over a messaging channel).
 * "sim" logs only. A future "whatsapp" adapter posts to the Baileys gateway or
 * the official WhatsApp Cloud API (VOUCHER_ENGINE.md §8) behind this contract.
 */
export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');

export interface SendMessageInput {
  to: string; // normalized 62… number
  text: string;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface NotificationProvider {
  readonly name: string;
  send(input: SendMessageInput): Promise<SendResult>;
}
