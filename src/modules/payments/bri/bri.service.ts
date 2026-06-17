import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, createSign, randomUUID } from 'crypto';

/** Per-merchant BRIAPI (SNAP) credentials, decrypted at call time. */
export interface BriCreds {
  baseUrl: string; // e.g. https://sandbox.partner.api.bri.co.id
  clientId: string; // X-CLIENT-KEY / consumer key
  clientSecret: string; // HMAC key for service signature + webhook verify
  privateKey: string; // RSA private key PEM (signs the B2B access-token request)
  partnerId: string; // X-PARTNER-ID
  merchantId: string;
  terminalId: string;
  channelId: string; // CHANNEL-ID
}

export interface BriQr {
  qrContent: string; // EMVCo QRIS payload to render
  referenceNo: string; // BRI's transaction id (for inquiry)
}

/**
 * BRIAPI SNAP-BI client (QRIS MPM Dynamic). Faithful to the BI SNAP signature spec:
 *  • B2B access token — X-SIGNATURE = base64(RSA-SHA256("{clientId}|{timestamp}")) with the
 *    partner private key; body {grantType:'client_credentials'}.
 *  • Service calls — X-SIGNATURE = base64(HMAC-SHA512(
 *      "{METHOD}:{path}:{accessToken}:{lowerhex(sha256(minifiedBody))}:{timestamp}", clientSecret)).
 * Endpoint paths follow developers.bri.co.id (override via BRI_* env if BRI changes them).
 */
@Injectable()
export class BriService {
  private readonly logger = new Logger('BRI:snap');
  private readonly timeoutMs = 15000;

  // SNAP relative paths (also used verbatim inside the service signature stringToSign).
  // Verified live against BRI sandbox: token is /snap/v1.0, QRIS service is v1.1 (no /snap),
  // because the subscribed product is "qris-mpm-dinamis-sandbox-v1.1".
  static readonly PATH_TOKEN = '/snap/v1.0/access-token/b2b';
  static readonly PATH_GENERATE = '/v1.1/qr-dynamic-mpm/qr-mpm-generate-qr';
  static readonly PATH_QUERY = '/v1.1/qr-dynamic-mpm/qr-mpm-query';

  /** ISO-8601 timestamp in Asia/Jakarta (+07:00) WITH milliseconds, as SNAP requires. */
  private timestamp(): string {
    return new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('Z', '+07:00');
  }

  /** SHA-256 of the minified JSON body, lowercase hex. */
  private bodyHash(body: unknown): string {
    const minified = JSON.stringify(body ?? {});
    return createHash('sha256').update(minified, 'utf8').digest('hex').toLowerCase();
  }

  /** Asymmetric signature for the B2B access-token request (RSA-SHA256). */
  private authSignature(clientId: string, ts: string, privateKey: string): string {
    return createSign('RSA-SHA256').update(`${clientId}|${ts}`).sign(privateKey, 'base64');
  }

  /** Symmetric service signature (HMAC-SHA512) over the SNAP canonical string. */
  serviceSignature(method: string, path: string, accessToken: string, body: unknown, ts: string, clientSecret: string): string {
    const stringToSign = `${method}:${path}:${accessToken}:${this.bodyHash(body)}:${ts}`;
    return createHmac('sha512', clientSecret).update(stringToSign, 'utf8').digest('base64');
  }

  private externalId(): string {
    // 36-char numeric-ish unique id (SNAP X-EXTERNAL-ID).
    return (Date.now().toString() + randomUUID().replace(/\D/g, '')).slice(0, 36).padEnd(12, '0');
  }

  private async post(url: string, headers: Record<string, string>, body: unknown): Promise<{ ok: boolean; status: number; json: any }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body ?? {}), signal: controller.signal });
      const json = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, json };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Step 1 — obtain a B2B access token (asymmetric-signed). */
  async getToken(c: BriCreds): Promise<string> {
    const ts = this.timestamp();
    const { ok, status, json } = await this.post(
      `${c.baseUrl}${BriService.PATH_TOKEN}`,
      {
        'Content-Type': 'application/json',
        'X-CLIENT-KEY': c.clientId,
        'X-TIMESTAMP': ts,
        'X-SIGNATURE': this.authSignature(c.clientId, ts, c.privateKey),
      },
      { grantType: 'client_credentials' },
    );
    const token = json?.accessToken ?? json?.access_token ?? null;
    if (!ok || !token) {
      this.logger.warn(`getToken failed (${status}): ${JSON.stringify(json)?.slice(0, 200)}`);
      throw new BadRequestException(json?.responseMessage ?? `BRI token gagal (HTTP ${status})`);
    }
    return token;
  }

  private serviceHeaders(c: BriCreds, method: string, path: string, token: string, body: unknown) {
    const ts = this.timestamp();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-TIMESTAMP': ts,
      'X-SIGNATURE': this.serviceSignature(method, path, token, body, ts, c.clientSecret),
      'X-PARTNER-ID': c.partnerId,
      'X-EXTERNAL-ID': this.externalId(),
      'CHANNEL-ID': c.channelId,
    };
  }

  /** Step 2 — generate a dynamic QRIS QR carrying the exact (unique) amount. */
  async generateQr(c: BriCreds, partnerReferenceNo: string, amountRupiah: number): Promise<BriQr> {
    const token = await this.getToken(c);
    const body = {
      partnerReferenceNo,
      amount: { value: amountRupiah.toFixed(2), currency: 'IDR' },
      merchantId: c.merchantId,
      terminalId: c.terminalId,
    };
    const { ok, status, json } = await this.post(
      `${c.baseUrl}${BriService.PATH_GENERATE}`,
      this.serviceHeaders(c, 'POST', BriService.PATH_GENERATE, token, body),
      body,
    );
    const qrContent = json?.qrContent ?? json?.qrString ?? null;
    if (!ok || !qrContent) {
      this.logger.warn(`generateQr failed (${status}): ${JSON.stringify(json)?.slice(0, 200)}`);
      throw new BadRequestException(json?.responseMessage ?? `BRI generate QR gagal (HTTP ${status})`);
    }
    return { qrContent, referenceNo: json?.referenceNo ?? '' };
  }

  /** Inquiry — poll a payment's status (backup to the webhook). 00 = success/settled. */
  async queryStatus(c: BriCreds, originalReferenceNo: string): Promise<{ status: string; raw: any }> {
    const token = await this.getToken(c);
    const body = { originalReferenceNo, serviceCode: '17', additionalInfo: { terminalId: c.terminalId } };
    const { json } = await this.post(
      `${c.baseUrl}${BriService.PATH_QUERY}`,
      this.serviceHeaders(c, 'POST', BriService.PATH_QUERY, token, body),
      body,
    );
    return { status: json?.latestTransactionStatus ?? json?.responseCode ?? '', raw: json };
  }

  /** Verify an inbound payment-notification signature (HMAC-SHA512 over the canonical string). */
  verifyNotification(method: string, path: string, body: unknown, ts: string, signature: string, clientSecret: string): boolean {
    // Notifications carry no access token in the canonical string (merchant-issuer scheme).
    const stringToSign = `${method}:${path}:${this.bodyHash(body)}:${ts}`;
    const expected = createHmac('sha512', clientSecret).update(stringToSign, 'utf8').digest('base64');
    // Some BRI variants include the token slot empty; accept the access-token-shaped variant too.
    const altToSign = `${method}:${path}::${this.bodyHash(body)}:${ts}`;
    const alt = createHmac('sha512', clientSecret).update(altToSign, 'utf8').digest('base64');
    return signature === expected || signature === alt;
  }
}
