import { Body, Controller, Headers, Logger, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { BriService } from '../payments/bri/bri.service';
import { OrderingService } from './ordering.service';

/**
 * Public BRIAPI QRIS MPM-Dynamic payment-notification webhook. BRI POSTs here when a
 * customer pays; we verify the SNAP signature with the merchant's clientSecret, then
 * confirm the matching payment (partnerReferenceNo === our payment.reference) → voucher
 * is delivered by the normal fulfillment path. Idempotent (confirmPayment is).
 *
 * Register this URL in the BRI developer portal as the merchant's notification endpoint.
 * Signature verification can be relaxed for sandbox bring-up via BRI_NOTIFY_VERIFY=false.
 */
@Controller('payments/bri')
export class BriNotifyController {
  private readonly logger = new Logger('BRI:notify');

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly bri: BriService,
    private readonly ordering: OrderingService,
  ) {}

  @Post('notify')
  async notify(
    @Body() body: any,
    @Headers('x-partner-id') partnerId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
    @Req() req: any,
  ) {
    const ref = body?.partnerReferenceNo ?? body?.originalPartnerReferenceNo ?? null;
    const status = String(body?.latestTransactionStatus ?? body?.responseCode ?? '');
    this.logger.log(`notify ref=${ref} status=${status} partner=${partnerId ?? '-'}`);

    // Resolve the merchant account by its BRI partner id (to get the verify secret).
    const account = partnerId
      ? await this.prisma.qrisAccount.findFirst({ where: { provider: 'bri', briPartnerId: partnerId } })
      : null;

    const verify = this.config.get<string>('BRI_NOTIFY_VERIFY', 'true') !== 'false';
    if (verify) {
      if (!account?.briClientSecretEnc || !signature || !timestamp) {
        return { responseCode: '4012700', responseMessage: 'Unauthorized: signature/partner invalid' };
      }
      const path =
        this.config.get<string>('BRI_NOTIFY_PATH') ||
        String(req?.originalUrl ?? '/api/v1/payments/bri/notify').split('?')[0];
      const ok = this.bri.verifyNotification('POST', path, body, timestamp, signature, this.crypto.decrypt(account.briClientSecretEnc));
      if (!ok) {
        this.logger.warn(`signature mismatch for ref=${ref}`);
        return { responseCode: '4012700', responseMessage: 'Unauthorized: signature mismatch' };
      }
    }

    // 00 = success/settled. Anything else: acknowledge but do not confirm.
    const paid = status === '00' || /success|settl|paid/i.test(status);
    if (ref && paid) {
      const r = await this.ordering.confirmPayment(String(ref));
      this.logger.log(`confirm ref=${ref} → ${r.status}`);
    }
    return { responseCode: '2007300', responseMessage: 'Successful' };
  }
}
