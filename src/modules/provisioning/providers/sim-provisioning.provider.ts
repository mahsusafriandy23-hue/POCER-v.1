import { Injectable, Logger } from '@nestjs/common';
import {
  CreateHotspotUserInput,
  ProvisionResult,
  ProvisioningProvider,
} from '../provisioning-provider.interface';

/**
 * Simulator provisioning provider. Pretends to create a hotspot user and always
 * succeeds. No RouterOS connection — safe for the isolated mirror.
 */
@Injectable()
export class SimProvisioningProvider implements ProvisioningProvider {
  readonly name = 'sim';
  private readonly logger = new Logger('Provisioning:sim');

  async createHotspotUser(input: CreateHotspotUserInput): Promise<ProvisionResult> {
    this.logger.log(
      `SIM create hotspot user name=${input.username} profile=${input.profile} server=${input.serverId ?? 'default'}`,
    );
    return { ok: true, externalId: `sim-${input.username}` };
  }
}
