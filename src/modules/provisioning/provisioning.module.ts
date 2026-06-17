import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProvisioningService } from './provisioning.service';
import { PROVISIONING_PROVIDER } from './provisioning-provider.interface';
import { SimProvisioningProvider } from './providers/sim-provisioning.provider';
import { RouterOsProvisioningProvider } from './providers/routeros-provisioning.provider';

@Module({
  providers: [
    ProvisioningService,
    SimProvisioningProvider,
    RouterOsProvisioningProvider,
    {
      provide: PROVISIONING_PROVIDER,
      inject: [ConfigService, SimProvisioningProvider, RouterOsProvisioningProvider],
      useFactory: (
        config: ConfigService,
        sim: SimProvisioningProvider,
        routeros: RouterOsProvisioningProvider,
      ) => {
        switch (config.get<string>('PROVISIONING_PROVIDER', 'sim')) {
          case 'routeros':
            return routeros;
          case 'sim':
          default:
            return sim;
        }
      },
    },
  ],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
