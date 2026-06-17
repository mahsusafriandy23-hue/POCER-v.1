import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface GobizSession {
  accessToken: string;
  refreshToken: string;
  merchantId: string | null;
}

/**
 * GoBiz / GoID merchant authentication (ACL). Ported from the legacy QRIS2 `lib/gopay.js`
 * token flow and extended with the phone+OTP login bootstrap.
 *
 *   • requestOtp(phone)            → GoID sends an OTP to the merchant phone, returns otpToken
 *   • verifyOtp(otpToken, otp)     → exchanges OTP for access+refresh tokens
 *   • refresh(refreshToken)        → renews the access token (the long-lived path)
 *
 * The OTP endpoints are GoID-internal and not publicly documented; they are kept
 * configurable (GOID_* env) and verified live. The refresh + /users/me flow is a
 * faithful port of the proven legacy code.
 */
@Injectable()
export class GobizAuthService {
  private readonly logger = new Logger('GoBiz:auth');
  private readonly tokenUrl: string;
  private readonly loginUrl: string;
  private readonly meUrl: string;
  private readonly clientId: string;
  private readonly appVersion: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    const base = (config.get<string>('GOID_BASE_URL', 'https://api.gobiz.co.id') || '').replace(/\/+$/, '');
    this.tokenUrl = `${base}/goid/token`;
    this.loginUrl = config.get<string>('GOID_LOGIN_URL', `${base}/goid/login/request`);
    this.meUrl = `${base}/v1/users/me`;
    // client_id that the proven mascafi/penanggak flow uses for OTP + token grants.
    this.clientId = config.get<string>('GOID_CLIENT_ID', 'go-biz-web-new');
    // GoID rejects stale app versions ("Harap perbarui versi"). Default = current
    // app.gobiz.com build; override via GOID_APP_VERSION when GoBiz bumps it.
    this.appVersion = config.get<string>('GOID_APP_VERSION', 'platform-v3.70.0-7d894db6');
    this.timeoutMs = Number(config.get('GOID_TIMEOUT_MS', 12000)) || 12000;
  }

  /** Headers — EXACT replica of the PROVEN legacy QRIS2 `lib/gopay.js` refresh request
   *  (Origin app.gobiz.com + older app version + Nexus UA). Verified live: this set yields
   *  HTTP 201 on /goid/token (refresh_token grant) and 200 on /v1/users/me. The newer
   *  portal.gofoodmerchant.co.id + v3.106 header set triggers a spurious "missing field"
   *  (goid:error:missing_field) on the refresh endpoint, so we keep the legacy set here.
   *  x-uniqueid regenerated per request. */
  private headers(auth = 'Bearer'): Record<string, string> {
    return {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'id',
      'authentication-type': 'go-id',
      authorization: auth,
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      'gojek-country-code': 'ID',
      'gojek-timezone': 'Asia/Bangkok',
      origin: 'https://app.gobiz.com',
      pragma: 'no-cache',
      priority: 'u=1, i',
      referer: 'https://app.gobiz.com/',
      'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      'user-agent':
        'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
      'x-appId': 'go-biz-web-dashboard',
      'x-appversion': this.appVersion,
      'x-deviceos': 'Web',
      'x-phonemake': 'Google',
      'x-phonemodel': 'Nexus 5',
      'x-platform': 'Web',
      'x-user-locale': 'en-US',
      'x-user-type': 'merchant',
      'x-uniqueid': randomUUID(),
    };
  }

  private async post(url: string, body: unknown, auth = 'Bearer'): Promise<{ ok: boolean; status: number; json: any }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers(auth),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      return { ok: res.ok, status: res.status, json };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Normalize "0812..", "+62812..", "62812.." → { countryCode:"+62", phone:"812.." }. */
  private splitPhone(raw: string): { countryCode: string; phone: string } {
    let p = (raw || '').replace(/[^\d]/g, '');
    if (p.startsWith('62')) p = p.slice(2);
    else if (p.startsWith('0')) p = p.slice(1);
    return { countryCode: '+62', phone: p };
  }

  /** Step 1 — request an OTP to the merchant's phone. Returns an otpToken for verify.
   *  Body/endpoint match the captured mascafi flow (gobiz_otp_login.js). */
  async requestOtp(rawPhone: string): Promise<{ otpToken: string }> {
    const { phone } = this.splitPhone(rawPhone);
    const { ok, status, json } = await this.post(this.loginUrl, {
      client_id: this.clientId,
      phone_number: phone,
      country_code: '62',
    });
    const otpToken =
      json?.data?.otp_token ?? json?.otp_token ?? json?.data?.session_token ?? json?.session_token ?? null;
    if (!ok || !otpToken) {
      this.logger.warn(`requestOtp failed (${status}): ${JSON.stringify(json)?.slice(0, 300)}`);
      throw new BadRequestException(
        json?.errors?.[0]?.message ?? json?.message ?? `Gagal kirim OTP (HTTP ${status}). Cek nomor/endpoint GoID.`,
      );
    }
    return { otpToken };
  }

  /** Step 2 — exchange the OTP for tokens, then resolve merchant_id via /users/me. */
  async verifyOtp(otpToken: string, otp: string): Promise<GobizSession> {
    const { ok, status, json } = await this.post(this.tokenUrl, {
      client_id: this.clientId,
      grant_type: 'otp',
      data: { otp_token: otpToken, otp },
    });
    if (!ok || !json?.access_token) {
      this.logger.warn(`verifyOtp failed (${status}): ${JSON.stringify(json)?.slice(0, 300)}`);
      throw new BadRequestException(json?.errors?.[0]?.message ?? json?.message ?? `OTP salah/kadaluarsa (HTTP ${status}).`);
    }
    const merchantId = await this.fetchMerchantId(json.access_token);
    return { accessToken: json.access_token, refreshToken: json.refresh_token, merchantId };
  }

  /** Headers matching the legacy password-grant path (portal.gofoodmerchant origin). */
  private passwordHeaders(): Record<string, string> {
    return {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'id',
      'Authentication-Type': 'go-id',
      Authorization: 'Bearer',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      'Gojek-Country-Code': 'ID',
      'Gojek-Timezone': 'Asia/Bangkok',
      Origin: 'https://portal.gofoodmerchant.co.id',
      Referer: 'https://portal.gofoodmerchant.co.id/',
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
      'X-AppVersion': 'platform-v3.80.0-be301d52',
      'X-Platform': 'Web',
      'X-User-Locale': 'id-ID',
      'X-User-Type': 'merchant',
      'x-DeviceOS': 'Web',
      'x-appId': 'go-biz-web-dashboard',
      'x-uniqueid': randomUUID(),
    };
  }

  /**
   * Primary bootstrap (matches the proven legacy flow): email/phone + password →
   * access+refresh tokens, then resolve merchant_id. Returns an `otpRequired` flag
   * if GoID responds with a step-up challenge instead of tokens.
   */
  async loginWithPassword(identifier: string, password: string): Promise<GobizSession & { otpRequired?: boolean; raw?: any }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let json: any = null;
    let status = 0;
    try {
      const res = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: this.passwordHeaders(),
        body: JSON.stringify({
          client_id: 'go-biz-web-new',
          grant_type: 'password',
          data: { email: identifier.trim(), password },
        }),
        signal: controller.signal,
      });
      status = res.status;
      json = await res.json().catch(() => null);
    } finally {
      clearTimeout(timer);
    }
    if (json?.access_token) {
      const merchantId = await this.fetchMerchantId(json.access_token);
      return { accessToken: json.access_token, refreshToken: json.refresh_token, merchantId };
    }
    // Surface a step-up/OTP challenge so the caller/UI can react, else a clear error.
    const msg = json?.errors?.[0]?.message ?? json?.message ?? `Login gagal (HTTP ${status})`;
    if (/otp|verification|verify|challenge/i.test(JSON.stringify(json ?? ''))) {
      return { accessToken: '', refreshToken: '', merchantId: null, otpRequired: true, raw: json };
    }
    throw new BadRequestException(msg);
  }

  /** Long-lived path — renew the access token from a stored refresh token. */
  async refresh(refreshToken: string): Promise<GobizSession> {
    const { ok, status, json } = await this.post(this.tokenUrl, {
      client_id: 'go-biz-web-new',
      grant_type: 'refresh_token',
      data: { refresh_token: refreshToken },
    });
    if (!ok || !json?.access_token) {
      this.logger.warn(`refresh failed (${status})`);
      throw new BadRequestException('Sesi GoBiz kedaluwarsa — hubungkan ulang.');
    }
    const merchantId = await this.fetchMerchantId(json.access_token);
    return { accessToken: json.access_token, refreshToken: json.refresh_token ?? refreshToken, merchantId };
  }

  private async fetchMerchantId(accessToken: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.meUrl, {
        method: 'GET',
        headers: { ...this.headers(`Bearer ${accessToken}`) },
        signal: controller.signal,
      });
      const json: any = await res.json().catch(() => null);
      return json?.user?.merchant_id ?? json?.data?.merchant_id ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
