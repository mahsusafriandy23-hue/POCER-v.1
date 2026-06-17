import { IsInt, IsOptional, IsPositive, IsString, Matches } from 'class-validator';

export class AdminCustomerTopupDto {
  /** Identify the customer by account id OR phone. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  customerId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'phone invalid' })
  phone?: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
