import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentCustomer } from '../identity/current-agent.decorator';
import { WalletService } from '../wallet/wallet.service';
import { AuthService } from '../identity/auth.service';
import { OrderingService } from './ordering.service';
import { TopupDto } from './dto/agent.dto';
import { CustomerPurchaseDto, SetProviderDto } from './dto/customer.dto';

@Controller('customer')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(
    private readonly wallet: WalletService,
    private readonly ordering: OrderingService,
    private readonly auth: AuthService,
  ) {}

  /** Profile incl. current provider ("Penyedia Layanan") — for the "Akun saya" page. */
  @Get('me')
  me(@CurrentCustomer() customerId: number) {
    return this.auth.customerMe(customerId);
  }

  /** Change the customer's provider. */
  @Put('provider')
  setProvider(@CurrentCustomer() customerId: number, @Body() dto: SetProviderDto) {
    return this.auth.setCustomerProvider(customerId, dto.providerId);
  }

  /** Outlets for THIS customer's provider (Penyedia Layanan). Falls back to all
   *  active outlets when the customer hasn't picked a provider yet. */
  @Get('outlets')
  outlets(@CurrentCustomer() customerId: number) {
    return this.ordering.customerOutlets(customerId);
  }

  @Get('wallet')
  balance(@CurrentCustomer() customerId: number) {
    return this.wallet.balanceFor('CUSTOMER', customerId);
  }

  @Get('wallet/transactions')
  transactions(@CurrentCustomer() customerId: number, @Query('limit') limit?: string) {
    return this.wallet.ledgerFor('CUSTOMER', customerId, limit ? Number(limit) : 50);
  }

  /** Self top-up balance via QRIS (like MyTelkomsel "isi saldo"). */
  @Post('topup')
  topup(@CurrentCustomer() customerId: number, @Body() dto: TopupDto) {
    return this.ordering.createCustomerTopup(customerId, dto.amount);
  }

  /**
   * Buy a voucher. payWith="balance" (default) debits saldo and returns the voucher
   * immediately; payWith="qris" returns a QR to pay (voucher arrives after payment).
   * Either way the voucher lands in this customer's inbox.
   */
  @Post('purchase')
  purchase(@CurrentCustomer() customerId: number, @Body() dto: CustomerPurchaseDto) {
    if (dto.payWith === 'qris') {
      return this.ordering.customerQrisPurchase(customerId, dto.packageId);
    }
    return this.ordering.customerWalletPurchase(customerId, dto.packageId);
  }

  /** Voucher inbox — all vouchers delivered into this account. */
  @Get('vouchers')
  vouchers(@CurrentCustomer() customerId: number) {
    return this.ordering.listCustomerVouchers(customerId);
  }
}
