import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CustomerAuthController } from './customer-auth.controller';
import { AdminAuthController } from './admin-auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginThrottleService } from './login-throttle.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-jwt-secret-change-me'),
        signOptions: { expiresIn: config.get<string>('JWT_TTL', '12h') },
      }),
    }),
  ],
  providers: [AuthService, JwtAuthGuard, LoginThrottleService],
  controllers: [AuthController, CustomerAuthController, AdminAuthController],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class IdentityModule {}
