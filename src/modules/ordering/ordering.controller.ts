import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrderingService } from './ordering.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrderingController {
  constructor(private readonly ordering: OrderingService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordering.createOrder(dto);
  }

  @Get(':reference')
  get(@Param('reference') reference: string) {
    return this.ordering.getByReference(reference);
  }

  @Get(':reference/status')
  async status(@Param('reference') reference: string) {
    const o = await this.ordering.getByReference(reference);
    return { reference: o.reference, status: o.status, fulfillStatus: o.fulfillStatus, vouchers: o.vouchers };
  }
}
