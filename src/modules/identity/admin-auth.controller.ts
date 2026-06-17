import { Body, Controller, Ip, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-auth.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto, @Ip() ip: string) {
    return this.auth.loginAdmin(dto, ip);
  }
}
