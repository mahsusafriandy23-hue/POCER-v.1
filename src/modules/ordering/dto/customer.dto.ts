import { IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';

export class CustomerPurchaseDto {
  @IsInt()
  @IsPositive()
  packageId!: number;

  /** "balance" (pay from saldo, default) or "qris" (pay QR directly). */
  @IsOptional()
  @IsIn(['balance', 'qris'])
  payWith?: 'balance' | 'qris';
}

export class SetProviderDto {
  /** Provider ("Penyedia Layanan") id to bind this customer to. */
  @IsInt()
  @IsPositive()
  providerId!: number;
}
