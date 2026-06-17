import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterCustomerDto, CustomerLoginDto } from './dto/customer-auth.dto';

@Controller('customer/auth')
export class CustomerAuthController {
  constructor(private readonly auth: AuthService) {}

  /** Public — providers ("Penyedia Layanan") for the signup dropdown. */
  @Get('providers')
  providers() {
    return this.auth.listProviders();
  }

  @Post('register')
  register(@Body() dto: RegisterCustomerDto) {
    return this.auth.registerCustomer(dto);
  }

  @Post('login')
  login(@Body() dto: CustomerLoginDto, @Ip() ip: string) {
    return this.auth.loginCustomer(dto, ip);
  }
}
