import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentAgent } from '../identity/current-agent.decorator';
import { OrderingService } from './ordering.service';
import { TopupDto, AgentPurchaseDto, AgentSellToCustomerDto, SetSellPriceDto } from './dto/agent.dto';

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly ordering: OrderingService) {}

  /** Agent profile + balance + assigned outlets. */
  @Get('me')
  me(@CurrentAgent() agentId: number) {
    return this.ordering.agentProfile(agentId);
  }

  /** Outlets the agent may sell for. */
  @Get('outlets')
  outlets(@CurrentAgent() agentId: number) {
    return this.ordering.agentOutlets(agentId);
  }

  /** Packages the agent may sell (agent price applied). */
  @Get('packages')
  packages(@CurrentAgent() agentId: number, @Query('server') server?: string) {
    return this.ordering.agentPackages(agentId, server ? Number(server) : undefined);
  }

  /** Sales stats: today / this-week / this-month counts + revenue. */
  @Get('stats')
  stats(@CurrentAgent() agentId: number) {
    return this.ordering.agentStats(agentId);
  }

  /** Daily revenue chart data for current month. */
  @Get('chart')
  chart(@CurrentAgent() agentId: number) {
    return this.ordering.agentChartData(agentId);
  }

  /** Connection status for each outlet's router. */
  @Get('server-status')
  serverStatus(@CurrentAgent() agentId: number) {
    return this.ordering.agentServerStatus(agentId);
  }

  /** Live customer detection for the sell screen (username or phone). Read-only. */
  @Get('customer-lookup')
  customerLookup(@CurrentAgent() agentId: number, @Query('handle') handle?: string) {
    return this.ordering.agentLookupCustomer(agentId, (handle ?? '').trim());
  }

  /** Set the agent's own selling price for a package (markup to the customer). */
  @Put('packages/:id/sell-price')
  setSellPrice(
    @CurrentAgent() agentId: number,
    @Param('id', ParseIntPipe) packageId: number,
    @Body() dto: SetSellPriceDto,
  ) {
    return this.ordering.setAgentSellPrice(agentId, packageId, dto.sellPrice);
  }

  /** Start a wallet top-up via QRIS (credited on payment). */
  @Post('topup')
  topup(@CurrentAgent() agentId: number, @Body() dto: TopupDto) {
    return this.ordering.createTopup(agentId, dto.amount);
  }

  /** Buy a voucher from wallet, delivered to a WhatsApp number (legacy/offline). */
  @Post('purchase')
  purchase(@CurrentAgent() agentId: number, @Body() dto: AgentPurchaseDto) {
    return this.ordering.agentWalletPurchase(agentId, dto.packageId, dto.customerWhatsapp, dto.pin);
  }

  /** Sell a voucher INTO a customer's account (inbox) by their username (or legacy id). */
  @Post('sell-to-customer')
  sellToCustomer(@CurrentAgent() agentId: number, @Body() dto: AgentSellToCustomerDto) {
    return this.ordering.agentSellToCustomer(
      agentId,
      { username: dto.username, customerId: dto.customerId },
      dto.packageId,
      dto.pin,
    );
  }

  /** Sell multiple packages in one shot (cart checkout). */
  @Post('sell-batch')
  sellBatch(
    @CurrentAgent() agentId: number,
    @Body() dto: {
      items: { packageId: number; qty: number }[];
      username?: string;
      customerWhatsapp?: string;
      pin?: string;
    },
  ) {
    return this.ordering.agentSellBatch(agentId, dto);
  }

  // ─── Contacts ────────────────────────────────────────────────────────────

  @Get('contacts')
  listContacts(@CurrentAgent() agentId: number) {
    return this.ordering.listContacts(agentId);
  }

  @Post('contacts')
  createContact(
    @CurrentAgent() agentId: number,
    @Body() dto: { name: string; username?: string; phone?: string; note?: string },
  ) {
    return this.ordering.createContact(agentId, dto);
  }

  @Patch('contacts/:id')
  updateContact(
    @CurrentAgent() agentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { name?: string; username?: string; phone?: string; note?: string },
  ) {
    return this.ordering.updateContact(agentId, id, dto);
  }

  @Delete('contacts/:id')
  deleteContact(
    @CurrentAgent() agentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordering.deleteContact(agentId, id);
  }
}
