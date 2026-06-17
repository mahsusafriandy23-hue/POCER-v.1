import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AuthedRequest extends Request {
  principalId?: number;
  actor?: 'agent' | 'customer' | 'admin' | 'assistant';
  /** convenience alias when actor === 'agent' */
  agentId?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7);
    try {
      const payload = this.jwt.verify<{ sub: number; actor: 'agent' | 'customer' | 'admin' | 'assistant' }>(token);
      req.principalId = payload.sub;
      req.actor = payload.actor;
      if (payload.actor === 'agent') req.agentId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
