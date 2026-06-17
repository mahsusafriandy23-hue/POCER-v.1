import { IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  /** Username or phone. */
  @IsString()
  @MinLength(3)
  login!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
