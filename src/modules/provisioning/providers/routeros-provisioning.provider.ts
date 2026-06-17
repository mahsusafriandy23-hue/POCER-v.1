import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateHotspotUserInput,
  ProvisionResult,
  ProvisioningProvider,
} from '../provisioning-provider.interface';
import { RouterOsClient } from '../routeros/routeros-client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CryptoService } from '../../../common/crypto/crypto.service';

interface RouterCreds {
  host: string;
  port: number;
  user: string;
  pass: string;
  source: string;
}

/**
 * Real RouterOS provisioning adapter (ACL). Resolves per-server router credentials
 * from the DB (password decrypted at use) so each location provisions on its OWN
 * router (multi-location). Falls back to ROUTEROS_* env if a server has no creds
 * (single-router dev). Verified against scripts/mock-routeros.js. TEST routers only.
 */
@Injectable()
export class RouterOsProvisioningProvider implements ProvisioningProvider {
  readonly name = 'routeros';
  private readonly logger = new Logger('Provisioning:routeros');
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {
    this.timeoutMs = Number(config.get('ROUTEROS_TIMEOUT_MS', 8000)) || 8000;
  }

  private async resolveCreds(serverId: number | null): Promise<RouterCreds | null> {
    if (serverId) {
      const s = await this.prisma.server.findUnique({ where: { id: serverId } });
      if (s && s.mikrotikIp && s.mikrotikUser && s.mikrotikPassEnc) {
        return {
          host: s.mikrotikIp,
          port: s.mikrotikPort,
          user: s.mikrotikUser,
          pass: this.crypto.decrypt(s.mikrotikPassEnc),
          source: `server#${serverId}`,
        };
      }
    }
    // Fallback: single router from env (dev / not-yet-configured servers)
    const host = this.config.get<string>('ROUTEROS_HOST', '');
    if (host) {
      return {
        host,
        port: Number(this.config.get('ROUTEROS_PORT', 8728)) || 8728,
        user: this.config.get<string>('ROUTEROS_USER', 'admin'),
        pass: this.config.get<string>('ROUTEROS_PASS', ''),
        source: 'env',
      };
    }
    return null;
  }

  async createHotspotUser(input: CreateHotspotUserInput): Promise<ProvisionResult> {
    const creds = await this.resolveCreds(input.serverId);
    if (!creds) {
      return { ok: false, error: `no router credentials for server#${input.serverId ?? 'default'}` };
    }
    const client = new RouterOsClient();
    try {
      await client.connect(creds.host, creds.port, this.timeoutMs);
      const login = await client.login(creds.user, creds.pass, this.timeoutMs);
      if (!login.ok) return { ok: false, error: `login failed (${creds.source}): ${login.error ?? 'unknown'}` };

      const res = await client.command(
        [
          '/ip/hotspot/user/add',
          `=name=${input.username}`,
          `=password=${input.password}`,
          `=profile=${input.profile}`,
          `=comment=${input.comment}`,
        ],
        this.timeoutMs,
      );
      if (!res.ok) {
        this.logger.warn(`add failed (${creds.source}): ${res.error}`);
        return { ok: false, error: res.error };
      }
      this.logger.log(`created ${input.username} via ${creds.source} (id=${res.ret ?? '?'})`);
      return { ok: true, externalId: res.ret };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'routeros error' };
    } finally {
      client.close();
    }
  }
}
