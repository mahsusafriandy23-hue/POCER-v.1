import { BadRequestException, Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { BuildQrInput, BuiltQr, PaymentProvider } from '../payment-provider.interface';
import { BriService } from '../bri/bri.service';

/**
 * BRI QRIS (MPM Dynamic) QR builder. Unlike GoBiz (QR built locally from a static template),
 * BRI ISSUES the dynamic QR via BRIAPI — each QR already carries the exact (unique) amount and
 * is a fully-registered interbank merchant QR. The returned qrContent is rendered locally to a
 * data URL (never sent to a third party). Detection is push (webhook) + inquiry, not journals.
 */
@Injectable()
export class BriPaymentProvider implements PaymentProvider {
  readonly name = 'bri';

  constructor(private readonly bri: BriService) {}

  async buildQr(input: BuildQrInput): Promise<BuiltQr> {
    if (!input.bri) {
      throw new BadRequestException('Kredensial BRI belum diatur untuk QRIS ini.');
    }
    // partnerReferenceNo links the BRI transaction back to our payment (our `reference`).
    const { qrContent } = await this.bri.generateQr(input.bri, input.reference, input.totalAmount);
    const qrUrl = await QRCode.toDataURL(qrContent, { errorCorrectionLevel: 'M', margin: 2, width: 350 });
    return { qrUrl, payload: qrContent };
  }
}
