import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentAdmin } from '../identity/current-agent.decorator';
import { OwnerService } from './owner.service';
import {
  UpdatePackageDto,
  OwnerCustomerTopupDto,
  CreateBrandDto,
  UpdateBrandDto,
  UpdateOutletDto,
  CreatePackageDto,
  CreateOutletDto,
  UpdateRouterDto,
  UpdateProfileDto,
  UpdateQrisDto,
  UpdateWhatsappDto,
  UpdateVoucherFormatDto,
  CreateQrisAccountDto,
  UpdateQrisAccountDto,
  UpdateQrisBriDto,
  AssignQrisOutletsDto,
  GobizPasswordLoginDto,
  GobizRequestOtpDto,
  GobizVerifyOtpDto,
  GobizRefreshTokenDto,
  CreateCustomerDto,
  UpdateCustomerDto,
} from './dto/owner.dto';

/** Owner (business-owner) console. All routes scoped to the owner's outlets. */
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  @Get('me')
  me(@CurrentAdmin() adminId: number) {
    return this.owner.me(adminId);
  }

  @Get('outlets')
  outlets(@CurrentAdmin() adminId: number) {
    return this.owner.outlets(adminId);
  }

  @Post('outlets')
  createOutlet(@CurrentAdmin() adminId: number, @Body() dto: CreateOutletDto) {
    return this.owner.createOutlet(adminId, dto);
  }

  @Patch('outlets/:id')
  updateOutlet(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOutletDto,
  ) {
    return this.owner.updateOutlet(adminId, id, dto);
  }

  @Get('packages')
  packages(@CurrentAdmin() adminId: number, @Query('server') server?: string) {
    return this.owner.listPackages(adminId, server ? Number(server) : undefined);
  }

  @Post('packages')
  createPackage(@CurrentAdmin() adminId: number, @Body() dto: CreatePackageDto) {
    return this.owner.createPackage(adminId, dto);
  }

  @Patch('packages/:id')
  updatePackage(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.owner.updatePackage(adminId, id, dto);
  }

  @Delete('packages/:id')
  deletePackage(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.owner.deletePackage(adminId, id);
  }

  @Get('customers')
  customers(@CurrentAdmin() adminId: number, @Query('search') search?: string) {
    return this.owner.listCustomers(adminId, search);
  }

  @Post('customers')
  createCustomer(@CurrentAdmin() adminId: number, @Body() dto: CreateCustomerDto) {
    return this.owner.createCustomer(adminId, dto);
  }

  @Get('customers/:id')
  getCustomer(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.owner.getCustomer(adminId, id);
  }

  @Patch('customers/:id')
  updateCustomer(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.owner.updateCustomer(adminId, id, dto);
  }

  @Delete('customers/:id')
  deleteCustomer(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.owner.deleteCustomer(adminId, id);
  }

  @Post('customers/topup')
  topupCustomer(@CurrentAdmin() adminId: number, @Body() dto: OwnerCustomerTopupDto) {
    return this.owner.topupCustomer(adminId, dto);
  }

  // ── Integrations / Settings ──
  @Get('settings')
  settings(@CurrentAdmin() adminId: number) {
    return this.owner.settings(adminId);
  }

  @Put('settings/profile')
  updateProfile(@CurrentAdmin() adminId: number, @Body() dto: UpdateProfileDto) {
    return this.owner.updateProfile(adminId, dto.brandName);
  }

  @Put('settings/qris')
  updateQris(@CurrentAdmin() adminId: number, @Body() dto: UpdateQrisDto) {
    return this.owner.updateQris(adminId, dto);
  }

  @Put('settings/whatsapp')
  updateWhatsapp(@CurrentAdmin() adminId: number, @Body() dto: UpdateWhatsappDto) {
    return this.owner.updateWhatsapp(adminId, dto);
  }

  // ── Brands (1 owner → many brands; outlets/QRIS/agents attach to a brand) ──
  @Get('brands')
  listBrands(@CurrentAdmin() adminId: number) {
    return this.owner.listBrands(adminId);
  }

  @Post('brands')
  createBrand(@CurrentAdmin() adminId: number, @Body() dto: CreateBrandDto) {
    return this.owner.createBrand(adminId, dto);
  }

  @Patch('brands/:id')
  updateBrand(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.owner.updateBrand(adminId, id, dto);
  }

  // ── QRIS accounts (multiple; outlets routed per-account) ──
  @Get('qris')
  listQris(@CurrentAdmin() adminId: number) {
    return this.owner.listQris(adminId);
  }

  @Post('qris')
  createQris(@CurrentAdmin() adminId: number, @Body() dto: CreateQrisAccountDto) {
    return this.owner.createQris(adminId, dto);
  }

  /** Upload a QRIS photo → decode + extract payload/merchant (does not persist). */
  @Post('qris/decode')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  decodeQris(@UploadedFile() file: { buffer?: Buffer; mimetype?: string; size?: number }) {
    return this.owner.decodeQrisFromImage(file);
  }

  @Put('qris/:id')
  updateQrisAccount(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQrisAccountDto,
  ) {
    return this.owner.updateQrisAccount(adminId, id, dto);
  }

  @Delete('qris/:id')
  deleteQris(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.owner.deleteQris(adminId, id);
  }

  @Put('qris/:id/bri')
  setQrisBri(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQrisBriDto,
  ) {
    return this.owner.setQrisBri(adminId, id, dto);
  }

  @Delete('qris/:id/bri')
  unsetQrisBri(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.owner.unsetQrisBri(adminId, id);
  }

  @Put('qris/:id/outlets')
  assignQrisOutlets(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignQrisOutletsDto,
  ) {
    return this.owner.assignQrisOutlets(adminId, id, dto);
  }

  // ── GoBiz merchant connect (enables real payment detection) ──
  @Post('qris/:id/gobiz/login')
  gobizLogin(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GobizPasswordLoginDto,
  ) {
    return this.owner.gobizLoginPassword(adminId, id, dto.identifier, dto.password);
  }

  @Post('qris/:id/gobiz/request-otp')
  gobizRequestOtp(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GobizRequestOtpDto,
  ) {
    return this.owner.gobizRequestOtp(adminId, id, dto.phone);
  }

  @Post('qris/:id/gobiz/verify-otp')
  gobizVerifyOtp(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GobizVerifyOtpDto,
  ) {
    return this.owner.gobizVerifyOtp(adminId, id, dto.otpToken, dto.otp, dto.phone);
  }

  @Post('qris/:id/gobiz/refresh-token')
  gobizConnectRefreshToken(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GobizRefreshTokenDto,
  ) {
    return this.owner.gobizConnectRefreshToken(adminId, id, dto.refreshToken);
  }

  @Delete('qris/:id/gobiz')
  gobizDisconnect(@CurrentAdmin() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.owner.gobizDisconnect(adminId, id);
  }

  @Put('outlets/:id/router')
  updateRouter(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRouterDto,
  ) {
    return this.owner.updateRouter(adminId, id, dto);
  }

  @Put('outlets/:id/voucher-format')
  updateVoucherFormat(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVoucherFormatDto,
  ) {
    return this.owner.updateVoucherFormat(adminId, id, dto);
  }

  @Post('outlets/:id/router/test')
  testRouter(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.owner.testRouter(adminId, id);
  }

  @Get('outlets/:id/router/profiles')
  routerProfiles(
    @CurrentAdmin() adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.owner.routerProfiles(adminId, id);
  }

  @Get('reports')
  reports(
    @CurrentAdmin() adminId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.owner.reports(adminId, from, to);
  }

  @Get('transactions')
  transactions(
    @CurrentAdmin() adminId: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.owner.transactions(adminId, {
      search,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Delete('transactions')
  deleteTransactions(
    @CurrentAdmin() adminId: number,
    @Body() body: { ids: number[] },
  ) {
    return this.owner.deleteTransactions(adminId, body.ids);
  }
}
