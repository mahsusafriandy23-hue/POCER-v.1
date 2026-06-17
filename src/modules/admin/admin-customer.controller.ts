import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { CustomerAdminService } from './customer-admin.service';
import { AdminCustomerTopupDto } from './dto/customer-topup.dto';

@Controller('platform/customers')
@UseGuards(AdminKeyGuard)
export class AdminCustomerController {
  constructor(private readonly customers: CustomerAdminService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.customers.list(search);
  }

  @Post('topup')
  topup(@Body() dto: AdminCustomerTopupDto) {
    return this.customers.topup(dto);
  }
}
