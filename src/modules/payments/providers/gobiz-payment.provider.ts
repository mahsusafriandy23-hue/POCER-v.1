import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { BuildQrInput, BuiltQr, PaymentProvider } from '../payment-provider.interface';

/**
 * Real QRIS (GoBiz/GoPay) QR builder — ACL, faithful port of the legacy
 * QRIS2/module.js algorithm (PAYMENT_FLOW.md §3):
 *   • start from a static EMV QRIS template,
 *   • flip tag 01 "11" (static) → "12" (dynamic),
 *   • inject tag 54 (transaction amount) right before "5802ID",
 *   • recompute CRC16/CCITT-FALSE and append.
 * This produces a genuinely scannable dynamic QR — NO network needed for the build.
 *
 * NOTE: payment *detection* (polling GoBiz journals/search) requires a real merchant
 * session and is intentionally NOT wired here (kept stub/manual). Confirmation still
 * arrives via the webhook (or, in dev, the sim/pay endpoint).
 */
@Injectable()
export class GobizPaymentProvider implements PaymentProvider {
  readonly name = 'gobiz';
  private readonly logger = new Logger('Payment:gobiz');
  private readonly qrisTemplate: string;
  /**
   * How the dynamic QR carries the amount. Some merchants are only registered for STATIC
   * interbank QRIS at the national switch: a converted dynamic QR (POI 12) is then rejected
   * by banks ("merchant not found") even though GoPay accepts it. Configurable so we can
   * match each merchant's registration without code changes:
   *   • 'dynamic'       — flip POI 11→12 + inject amount (EMVCo-correct dynamic; legacy default)
   *   • 'static-amount' — keep POI 11 + inject amount (closest to the working static QR)
   *   • 'static'        — serve the static QR untouched (no amount; customer types it)
   */
  private readonly amountMode: 'dynamic' | 'static-amount' | 'static';

  // A structurally-valid SYNTHETIC template (not a real merchant). Override via QRIS_TEXT.
  private static readonly SYNTHETIC =
    '00020101021126590013ID.CO.SYNTH.WWW0118SYNTHETICMERCHANT010303UMI520454995802ID5909TEST SHOP6007JAKARTA61051234562070703A016304ABCD';

  constructor(config: ConfigService) {
    const fromEnv = config.get<string>('QRIS_TEXT');
    this.qrisTemplate = (fromEnv && fromEnv.trim()) || GobizPaymentProvider.SYNTHETIC;
    if (!fromEnv) {
      this.logger.warn('QRIS_TEXT not set — using SYNTHETIC template (QR builds correctly but is not a real merchant).');
    }
    const mode = (config.get<string>('QRIS_AMOUNT_MODE', 'dynamic') || 'dynamic').trim();
    this.amountMode = (['dynamic', 'static-amount', 'static'].includes(mode) ? mode : 'dynamic') as
      | 'dynamic'
      | 'static-amount'
      | 'static';
  }

  /** CRC16/CCITT-FALSE, identical to legacy crc16ccitt(). */
  private crc16(str: string): string {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= (str.charCodeAt(i) & 0xff) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  async buildQr(input: BuildQrInput): Promise<BuiltQr> {
    // Prefer the order outlet's own QRIS (per-outlet routing); fall back to global.
    const tmpl = (input.qrisText && input.qrisText.trim()) || this.qrisTemplate;
    if (!tmpl.includes('5802ID')) {
      throw new Error('Invalid QRIS template: missing "5802ID" tag');
    }

    // Per-account mode (QrisAccount.paymentMode) overrides the global default.
    const allowed = ['dynamic', 'static-amount', 'static'];
    const mode = (input.paymentMode && allowed.includes(input.paymentMode) ? input.paymentMode : this.amountMode) as
      | 'dynamic'
      | 'static-amount'
      | 'static';

    let payload: string;
    if (mode === 'static') {
      // Serve the static QR exactly as registered — guaranteed interbank-compatible where
      // the static QR works. No amount embedded; the customer types the unique total.
      payload = tmpl;
    } else {
      // Drop the existing 4-char CRC. Flip POI 11→12 only in full 'dynamic' mode.
      let withoutCrc = tmpl.slice(0, -4);
      if (mode === 'dynamic') withoutCrc = withoutCrc.replace('010211', '010212');

      // inject tag 54 = amount, just before 5802ID
      const amount = String(input.totalAmount);
      const amountTag = `54${String(amount.length).padStart(2, '0')}${amount}5802ID`;
      const [head, tail] = withoutCrc.split('5802ID');
      payload = head + amountTag + tail;
      payload += this.crc16(payload);
    }

    // Render the QR LOCALLY (no third-party): keeps the merchant QRIS payload private
    // — it must never be sent to an external service like quickchart.io — and guarantees
    // the rendered QR is byte-exact with `payload`. ECC level 'M' matches QRIS norms.
    const qrUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 350 });
    return { qrUrl, payload };
  }
}
