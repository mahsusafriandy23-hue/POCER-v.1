import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from './notification-provider.interface';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider,
  ) {}

  /** Humanize a package duration code ("1d"/"24h"/"30m") for messages. */
  private humanValidity(duration?: string | null): string | null {
    if (!duration) return null;
    const m = /^(\d+)\s*([dhm])$/.exec(duration.trim());
    if (!m) return duration;
    const n = Number(m[1]);
    const unit = m[2] === 'd' ? 'hari' : m[2] === 'h' ? 'jam' : 'menit';
    return `${n} ${unit}`;
  }

  /** Voucher delivery message (mirrors voucher_delivery template, BR-21/22). */
  async sendVoucher(opts: {
    to: string;
    packageName: string;
    username: string;
    password: string;
    /** Package validity duration (e.g. "1d"). Masa aktif starts at first login. */
    validity?: string | null;
  }): Promise<boolean> {
    const sameCreds = opts.username === opts.password;
    const cred = sameCreds
      ? `Kode: ${opts.username}`
      : `Username: ${opts.username}\nPassword: ${opts.password}`;
    const human = this.humanValidity(opts.validity);
    // Masa aktif dihitung sejak login pertama di hotspot (bukan sejak voucher dibuat).
    const validityLine = human
      ? `\nMasa aktif: ${human} (dihitung sejak login pertama)`
      : '';
    const text =
      `Terima kasih. Berikut voucher WiFi Anda:\n\n` +
      `Paket: ${opts.packageName}\n${cred}${validityLine}`;
    const r = await this.provider.send({ to: opts.to, text });
    return r.ok;
  }
}
