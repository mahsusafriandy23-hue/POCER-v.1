import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateOwnerDto {
  @IsString() name!: string;

  /** Customer-facing provider/brand name ("Penyedia Layanan"), e.g. "Penanggak .NET". */
  @IsOptional() @IsString() brandName?: string;

  @Matches(/^[a-z0-9._]{3,20}$/, { message: 'Username 3-20 huruf kecil/angka/._' })
  username!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor tidak valid' })
  phone?: string;

  @IsString() @MinLength(6) password!: string;

  @IsOptional() @IsString() pin?: string;

  /** Grant control over ALL outlets (current + future), not just assigned ones. */
  @IsOptional() @IsBoolean() manageAllOutlets?: boolean;
}

export class UpdateOwnerDto {
  @IsOptional() @IsString() name?: string;

  @IsOptional() @IsString() brandName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor tidak valid' })
  phone?: string;

  @IsOptional() @IsString() @MinLength(6) password?: string;

  @IsOptional() @IsString() pin?: string;

  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';

  @IsOptional() @IsBoolean() manageAllOutlets?: boolean;
}

export class AssignOutletsDto {
  /** The full set of server ids this owner manages (replaces previous assignment). */
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  serverIds!: number[];
}
