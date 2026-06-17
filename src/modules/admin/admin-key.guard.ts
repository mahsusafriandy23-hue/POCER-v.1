import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Minimal admin auth via a shared secret header `X-Admin-Key` (env ADMIN_API_KEY).
 * Deny if the key isn't configured. (A full admin-identity/RBAC system can replace this later.)
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.config.get<string>('ADMIN_API_KEY', '');
    if (!configured) throw new UnauthorizedException('admin API disabled (ADMIN_API_KEY not set)');
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-admin-key'];
    if (provided !== configured) throw new UnauthorizedException('invalid admin key');
    return true;
  }
}
