import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthedRequest } from './jwt-auth.guard';

/** Injects the authenticated agent id (requires actor=agent). */
export const CurrentAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.actor !== 'agent' || !req.principalId) {
      throw new ForbiddenException('Agent token required');
    }
    return req.principalId;
  },
);

/** Injects the authenticated customer id (requires actor=customer). */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.actor !== 'customer' || !req.principalId) {
      throw new ForbiddenException('Customer token required');
    }
    return req.principalId;
  },
);

/** Injects the authenticated admin/owner id (requires actor=admin). */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.actor !== 'admin' || !req.principalId) {
      throw new ForbiddenException('Admin token required');
    }
    return req.principalId;
  },
);

export const CurrentAssistant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.actor !== 'assistant' || !req.principalId) {
      throw new ForbiddenException('Assistant token required');
    }
    return req.principalId;
  },
);
