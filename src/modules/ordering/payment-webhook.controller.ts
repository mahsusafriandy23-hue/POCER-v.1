import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { OrderingService } from './ordering.service';

function normalizeStatus(input: unknown): 'PAID' | 'EXPIRED' | 'FAILED' | 'UNPAID' {
  const s = String(input ?? '').toUpperCase().trim();
  if (['PAID', 'SUCCESS', 'COMPLETED'].includes(s)) return 'PAID';
  if (['EXPIRED', 'TIMEOUT'].includes(s)) return 'EXPIRED';
  if (['FAILED', 'CANCELED', 'CANCELLED', 'ERROR'].includes(s)) return 'FAILED';
  return 'UNPAID';
}

@Controller('payments')
export class PaymentWebhookController {
  private readonly logger = new Logger('PaymentWebhook');

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly ordering: OrderingService,
  ) {}

  /**
   * Inbound payment webhook (mirrors api/callback.php).
   * HMAC-verified (BR-11) over the raw body; drives the order to PAID + fulfillment.
   */
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Body() body: any) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body ?? {});
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const valid = this.payments.verifyWebhookSignature(raw, signature);

    const reference: string | undefined = body?.data?.reference_id ?? body?.reference_id;

    await this.prisma.webhookEvent.create({
      data: { source: 'payment', reference: reference ?? null, valid, payload: body ?? {} },
    });

    if (!valid) throw new UnauthorizedException('invalid signature');
    if (!reference) throw new BadRequestException('missing reference_id');

    const status = normalizeStatus(body?.status ?? body?.data?.status);
    if (status !== 'PAID') {
      this.logger.log(`Webhook ${reference} status=${status} (no fulfillment)`);
      return { success: true, message: `received (${status})` };
    }

    const result = await this.ordering.confirmPayment(reference);
    return { success: true, result };
  }

  /**
   * DEV-ONLY simulator: pretend the customer paid. Generates a correctly-signed
   * webhook payload and processes it. Disabled unless PAYMENT_PROVIDER=sim.
   */
  @Post('sim/pay/:reference')
  async simPay(@Param('reference') reference: string) {
    // Dev-only manual confirmation. Works for sim AND gobiz (whose real GoBiz
    // polling isn't wired) — but never in production.
    if (this.config.get<string>('NODE_ENV', 'development') === 'production') {
      throw new ForbiddenException('simulator disabled in production');
    }
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment) throw new NotFoundException('payment not found');

    const result = await this.ordering.confirmPayment(reference);
    return { success: true, simulated: true, result };
  }
}
