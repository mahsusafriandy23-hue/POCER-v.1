import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateServerDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() mikrotikIp?: string;
  @IsOptional() @IsInt() @Min(1) mikrotikPort?: number;
  @IsOptional() @IsString() mikrotikUser?: string;
  @IsOptional() @IsString() mikrotikPass?: string; // stored encrypted
  @IsOptional() @IsString() dnsName?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateServerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() mikrotikIp?: string;
  @IsOptional() @IsInt() @Min(1) mikrotikPort?: number;
  @IsOptional() @IsString() mikrotikUser?: string;
  @IsOptional() @IsString() mikrotikPass?: string; // stored encrypted
  @IsOptional() @IsString() dnsName?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}
