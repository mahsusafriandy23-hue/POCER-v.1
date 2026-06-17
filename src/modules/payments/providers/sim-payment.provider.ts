import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { BuildQrInput, BuiltQr, PaymentProvider } from '../payment-provider.interface';

/**
 * Simulator payment provider. Produces a deterministic, scannable-looking QR URL
 * but performs NO real payment. Mirrors the shape of the legacy QRIS2 createPayment()
 * output (qris_url) so downstream code is identical to production.
 */
@Injectable()
export class SimPaymentProvider implements PaymentProvider {
  readonly name = 'sim';

  async buildQr(input: BuildQrInput): Promise<BuiltQr> {
    // Synthetic "EMV-like" payload — purely for the mirror; not a valid QRIS.
    const payload = `SIMQRIS|ref=${input.reference}|amt=${input.totalAmount}`;
    const qrUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 350 });
    return { qrUrl, payload };
  }
}
