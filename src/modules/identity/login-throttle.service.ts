import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Lightweight in-memory login throttle (anti brute-force / credential stuffing).
 * Tracks failed attempts per key (IP and per-identifier) in a sliding window and
 * locks the key after too many failures. Thresholds are env-tunable
 * (LOGIN_THROTTLE_*).
 *
 * NOTE: in-memory — resets on restart and is per-instance. For multi-instance /
 * production, back this with Redis or a DB table. Behind a proxy (Cloudflare),
 * ensure the app trusts X-Forwarded-For so the real client IP is used.
 */
@Injectable()
export class LoginThrottleService {
  private readonly entries = new Map<string, { count: number; first: number; lockedUntil?: number }>();

  private readonly WINDOW_MS: number;
  private readonly MAX_FAILS: number;
  private readonly LOCK_MS: number;

  constructor(config: ConfigService) {
    this.WINDOW_MS = Number(config.get('LOGIN_THROTTLE_WINDOW_MS', 15 * 60 * 1000)) || 15 * 60 * 1000;
    this.MAX_FAILS = Number(config.get('LOGIN_THROTTLE_MAX_FAILS', 5)) || 5;
    this.LOCK_MS = Number(config.get('LOGIN_THROTTLE_LOCK_MS', 15 * 60 * 1000)) || 15 * 60 * 1000;
  }

  /** Throw 429 if any of the keys is currently locked. Call before verifying creds. */
  assertAllowed(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const e = this.entries.get(key);
      if (e?.lockedUntil && e.lockedUntil > now) {
        const sec = Math.ceil((e.lockedUntil - now) / 1000);
        const mins = Math.ceil(sec / 60);
        throw new HttpException(
          `Terlalu banyak percobaan login. Coba lagi dalam ${mins} menit.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  /** Record a failed attempt for each key; lock the key once it crosses the threshold. */
  recordFailure(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      let e = this.entries.get(key);
      if (!e || now - e.first > this.WINDOW_MS) e = { count: 0, first: now };
      e.count += 1;
      if (e.count >= this.MAX_FAILS) e.lockedUntil = now + this.LOCK_MS;
      this.entries.set(key, e);
    }
  }

  /** Clear counters for the keys after a successful login. */
  recordSuccess(keys: string[]): void {
    for (const key of keys) this.entries.delete(key);
  }
}
