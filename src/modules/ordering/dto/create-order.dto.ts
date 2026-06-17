import { IsInt, IsPositive, IsString, Matches } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  @IsPositive()
  packageId!: number;

  /** Raw WhatsApp number; normalized server-side (BR-8). */
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'customerWhatsapp invalid' })
  customerWhatsapp!: string;
}
