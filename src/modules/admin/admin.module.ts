import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminController } from './admin.controller';
import { AdminCustomerController } from './admin-customer.controller';
import { PlatformOwnerController } from './platform-owner.controller';
import { OperatorProviderController } from './operator-provider.controller';
import { PackageAdminController } from './package-admin.controller';
import { OutletLocationController } from './outlet-location.controller';
import { ServerAdminService } from './server-admin.service';
import { CustomerAdminService } from './customer-admin.service';
import { OwnerAdminService } from './owner-admin.service';
import { PackageAdminService } from './package-admin.service';
import { AdminKeyGuard } from './admin-key.guard';

@Module({
  imports: [WalletModule, IdentityModule],
  providers: [ServerAdminService, CustomerAdminService, OwnerAdminService, PackageAdminService, AdminKeyGuard],
  controllers: [
    AdminController,
    AdminCustomerController,
    PlatformOwnerController,
    OperatorProviderController,
    PackageAdminController,
    OutletLocationController,
  ],
})
export class AdminModule {}
