import { IsInt, IsOptional, IsPositive, IsString, MinLength, Matches } from 'class-validator';

export class RegisterCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  /** Provider ("Penyedia Layanan") the customer signs up under. Required. */
  @IsInt({ message: 'Penyedia Layanan wajib dipilih' })
  @IsPositive({ message: 'Penyedia Layanan wajib dipilih' })
  providerId!: number;

  @IsString()
  @Matches(/^[a-zA-Z0-9._]{3,20}$/, {
    message: 'username invalid (3-20 huruf/angka/titik/underscore)',
  })
  username!: string;

  @IsString({ message: 'Nomor WhatsApp wajib diisi' })
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor WhatsApp tidak valid' })
  phone!: string;

  @IsString({ message: 'Kata sandi wajib diisi' })
  @MinLength(6, { message: 'Kata sandi minimal 6 karakter' })
  password!: string;
}

export class CustomerLoginDto {
  @IsString({ message: 'Username atau nomor wajib diisi' })
  login!: string; // username OR phone

  @IsString({ message: 'Kata sandi wajib diisi' })
  password!: string;
}
