/**
 * Provisioning provider PORT (ACL over MikroTik RouterOS).
 * The "sim" adapter creates no real hotspot user. A future "routeros" adapter
 * implements /ip/hotspot/user/add (MIKROTIK_SYNC.md) behind this same contract.
 */
export const PROVISIONING_PROVIDER = Symbol('PROVISIONING_PROVIDER');

export interface CreateHotspotUserInput {
  username: string;
  password: string;
  profile: string;
  serverId: number | null;
  comment: string;
}

export interface ProvisionResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

export interface ProvisioningProvider {
  readonly name: string;
  createHotspotUser(input: CreateHotspotUserInput): Promise<ProvisionResult>;
}
