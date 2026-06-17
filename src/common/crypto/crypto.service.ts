import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Secrets-at-rest encryption (AES-256-GCM). Used for per-server router passwords
 * so credentials are NEVER stored in plaintext (closes audit finding S1).
 * Key derived from APP_ENCRYPTION_KEY. Format stored: base64(iv[12] | tag[16] | ciphertext).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private readonly logger = new Logger('Crypto');

  constructor(config: ConfigService) {
    const secret = config.get<string>('APP_ENCRYPTION_KEY', '');
    if (!secret) {
      this.logger.warn('APP_ENCRYPTION_KEY not set — using an insecure dev key. Set it in production!');
    }
    this.key = scryptSync(secret || 'dev-insecure-key', 'pocer-v1-salt', 32);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  decrypt(enc: string): string {
    const raw = Buffer.from(enc, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const d = createDecipheriv('aes-256-gcm', this.key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  }
}
