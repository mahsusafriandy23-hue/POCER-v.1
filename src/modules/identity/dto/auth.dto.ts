import { IsInt, IsOptional, IsPositive, IsString, MinLength, Matches } from 'class-validator';

export class RegisterAgentDto {
  @IsString()
  name!: string;

  /** Provider ("Penyedia Layanan"/Owner) this agent belongs to. Required. */
  @IsInt({ message: 'Penyedia Layanan wajib dipilih' })
  @IsPositive({ message: 'Penyedia Layanan wajib dipilih' })
  providerId!: number;

  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'phone invalid' })
  phone!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4,6}$/, { message: 'pin must be 4-6 digits' })
  pin?: string;
}

export class LoginDto {
  @IsString()
  login!: string; // username or phone

  @IsString()
  password!: string;
}
