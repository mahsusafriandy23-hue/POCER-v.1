import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderingService } from './ordering.service';

/**
 * Inbound hotspot events from the router (MikroTik on-login script). Drives
 * voucher ACTIVATION: validity (masa aktif) is counted from FIRST login, not from
 * generation. The router profile enforces the real cutoff; this records first
 * login so the app can display the correct "active until" date.
 *
 * Auth: shared secret in the `x-hotspot-key` header (HOTSPOT_WEBHOOK_KEY, falls
 * back to WEBHOOK_SECRET). The router script sends it on the on-login HTTP call.
 */
@Controller('provisioning/hotspot')
export class HotspotWebhookController {
  private readonly logger = new Logger('HotspotWebhook');

  constructor(
    private readonly config: ConfigService,
    private readonly ordering: OrderingService,
  ) {}

  @Post('login')
  async login(
    @Headers('x-hotspot-key') headerKey: string | undefined,
    @Body() body: { username?: string; key?: string; at?: string },
  ) {
    const expected =
      this.config.get<string>('HOTSPOT_WEBHOOK_KEY') ??
      this.config.get<string>('WEBHOOK_SECRET') ??
      '';
    // Key may arrive via header (preferred) or body (routers that only send JSON).
    const provided = headerKey ?? body?.key ?? '';
    if (!expected || provided !== expected) {
      throw new UnauthorizedException('Invalid hotspot key');
    }
    const username = (body?.username ?? '').trim();
    if (!username) throw new UnauthorizedException('username required');
    const at = body?.at ? new Date(body.at) : new Date();
    const loginAt = isNaN(at.getTime()) ? new Date() : at;
    const result = await this.ordering.activateVoucherOnLogin(username, loginAt);
    this.logger.log(
      `hotspot login user=${username} → ${
        !result.found
          ? 'not_found'
          : result.alreadyActive
            ? 'already_active'
            : 'activated'
      }`,
    );
    return result;
  }
}
