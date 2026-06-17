import { IsInt, IsOptional, IsPositive, IsString, Matches, Min } from 'class-validator';

export class TopupDto {
  @IsInt()
  @IsPositive()
  amount!: number;
}

export class AgentPurchaseDto {
  @IsInt()
  @IsPositive()
  packageId!: number;

  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'customerWhatsapp invalid' })
  customerWhatsapp!: string;

  @IsOptional()
  @IsString()
  pin?: string;
}

export class SetSellPriceDto {
  /** The agent's selling price to the customer (integer rupiah, >= their cost). */
  @IsInt()
  @Min(0)
  sellPrice!: number;
}

export class AgentSellToCustomerDto {
  /** Preferred: the customer's username/handle (what the agent asks for). */
  @IsOptional()
  @IsString()
  username?: string;

  /** Legacy: the customer's numeric account id (kept for backward compatibility). */
  @IsOptional()
  @IsInt()
  @IsPositive()
  customerId?: number;

  @IsInt()
  @IsPositive()
  packageId!: number;

  @IsOptional()
  @IsString()
  pin?: string;
}
