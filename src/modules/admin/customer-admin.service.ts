import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { normalizeWhatsapp } from '../../common/util/codes';
import { AdminCustomerTopupDto } from './dto/customer-topup.dto';

@Injectable()
export class CustomerAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async list(search?: string) {
    const where = search
      ? { OR: [{ phone: { contains: search } }, { name: { contains: search, mode: 'insensitive' as const } }] }
      : {};
    const customers = await this.prisma.customer.findMany({ where, orderBy: { id: 'desc' }, take: 100 });
    const out = [];
    for (const c of customers) {
      const bal = await this.wallet.balanceFor('CUSTOMER', c.id);
      out.push({ id: c.id, name: c.name, phone: c.phone, status: c.status, balance: bal.balance });
    }
    return out;
  }

  /** Admin credits a customer's balance (cash top-up). */
  async topup(dto: AdminCustomerTopupDto) {
    if (!dto.customerId && !dto.phone) throw new BadRequestException('provide customerId or phone');
    const where = dto.customerId
      ? { id: dto.customerId }
      : { phone: normalizeWhatsapp(dto.phone!) ?? '' };
    const customer = await this.prisma.customer.findUnique({ where });
    if (!customer) throw new NotFoundException('customer not found');

    const account = await this.wallet.ensureAccount('CUSTOMER', customer.id);
    const reference = `ADMIN-TOPUP-${Date.now()}-${randomBytes(4).toString('hex')}`;
    await this.wallet.credit(account.id, dto.amount, 'TOPUP', reference, dto.note ?? 'Admin top-up');
    const bal = await this.wallet.balanceFor('CUSTOMER', customer.id);
    return { customerId: customer.id, phone: customer.phone, credited: dto.amount, balance: bal.balance, reference };
  }
}
