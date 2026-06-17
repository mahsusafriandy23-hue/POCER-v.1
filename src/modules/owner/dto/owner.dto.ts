import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

// ── Brands (1 owner → many brands) ──
export class CreateBrandDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() slug?: string;
}

export class UpdateBrandDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

// ── Outlets ──
export class UpdateOutletDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() dnsName?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  /** Assign this outlet to a BRAND (its payments route to the brand's QRIS). */
  @IsOptional() @IsInt() @IsPositive() brandId?: number;
}

export class CreateOutletDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,20}$/, {
    message: 'Kode 2-20 huruf besar/angka/-_ (mis. KORLEKO)',
  })
  code!: string;

  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() dnsName?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  /** The BRAND this outlet belongs to. */
  @IsOptional() @IsInt() @IsPositive() brandId?: number;
}

// ── Packages ──
export class CreatePackageDto {
  @IsInt() serverId!: number;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(0) price!: number;
  @IsOptional() @IsInt() @Min(0) agentPrice?: number;

  /** Display label for customers, e.g. "1 Jam", "1 Hari". Free-form; actual validity is enforced by the MikroTik user-profile. */
  @IsString() @MinLength(1) @MaxLength(40)
  duration!: string;

  /** RouterOS hotspot profile name; defaults to "default" if omitted. */
  @IsOptional() @IsString() mikrotikProfile?: string;

  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Per-package jargon shown on the storefront card (e.g. "Sekali pakai", "Multi device"). */
  @IsOptional() @IsString() @MaxLength(60) dataLimit?: string;
  // Promo/marketing display (owner-controlled, scoped to owned outlets).
  @IsOptional() @IsInt() @Min(0) originalPrice?: number;
  @IsOptional() @IsString() promoLabel?: string;
  @IsOptional() @IsString() bonusLabel?: string;
  @IsOptional() @IsBoolean() isFlashSale?: boolean;
}

export class UpdatePackageDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) agentPrice?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Display label for customers, e.g. "1 Jam", "1 Hari". Free-form; actual validity is enforced by the MikroTik user-profile. */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40)
  duration?: string;
  /** RouterOS hotspot user-profile this package provisions to (speed/quota/validity). */
  @IsOptional() @IsString() mikrotikProfile?: string;
  /** Per-package jargon shown on the storefront card (e.g. "Sekali pakai", "Multi device"). */
  @IsOptional() @IsString() @MaxLength(60) dataLimit?: string;
  // Promo/marketing display (owner-controlled, scoped to owned outlets).
  @IsOptional() @IsInt() @Min(0) originalPrice?: number;
  @IsOptional() @IsString() promoLabel?: string;
  @IsOptional() @IsString() bonusLabel?: string;
  @IsOptional() @IsBoolean() isFlashSale?: boolean;
}

// ── Agents ──
export class CreateAgentDto {
  @IsString() name!: string;

  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor WhatsApp tidak valid' })
  phone!: string;

  @IsOptional()
  @Matches(/^[a-z0-9._]{3,20}$/, { message: 'Username 3-20 huruf kecil/angka/._' })
  username?: string;

  @IsString() @MinLength(6) password!: string;

  @IsOptional() @IsString() pin?: string;

  /** Per-agent discount off retail (0-100%), used when a package has no agentPrice. */
  @IsOptional() @IsInt() @Min(0) @Max(100) discountPercent?: number;

  /** The BRAND this agent sells under (its outlets/QRIS). Outlets must be within it. */
  @IsOptional() @IsInt() @IsPositive() brandId?: number;

  /** Optionally assign outlets immediately (subset of the agent's brand outlets). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  serverIds?: number[];
}

export class UpdateAgentDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsString() pin?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';
  @IsOptional() @IsInt() @Min(0) @Max(100) discountPercent?: number;
  /** Move this agent to another BRAND; outlets outside the new brand are cleared. */
  @IsOptional() @IsInt() @IsPositive() brandId?: number;
}

export class AssignAgentOutletsDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  serverIds!: number[];
}

export class AgentTopupDto {
  @IsInt() @IsPositive() amount!: number;
  @IsOptional() @IsString() note?: string;
}

// ── Integrations: Router (per-outlet) ──
export class UpdateRouterDto {
  @IsOptional() @IsString() mikrotikIp?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) mikrotikPort?: number;
  @IsOptional() @IsString() mikrotikUser?: string;
  /** Plaintext from the form; stored AES-256-GCM encrypted. Omit to keep current. */
  @IsOptional() @IsString() mikrotikPass?: string;
  /** Set true to clear stored router credentials for this outlet. */
  @IsOptional() @IsBoolean() clear?: boolean;
}

// ── Profile: customer-facing provider/brand name ──
export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) brandName?: string;
}

// ── Integrations: QRIS (per-owner, legacy single — superseded by QrisAccount) ──
export class UpdateQrisDto {
  /** Static QRIS payload / merchant string. Empty string clears it. */
  @IsOptional() @IsString() qrisText?: string;
  @IsOptional() @IsString() qrisMerchant?: string;
  @IsOptional() @IsString() qrisNmid?: string;
}

// ── Integrations: QRIS accounts (multiple per owner; outlets routed per-account) ──
export class CreateQrisAccountDto {
  @IsString() @MinLength(1) label!: string;
  @IsOptional() @IsString() qrisText?: string;
  @IsOptional() @IsString() merchant?: string;
  @IsOptional() @IsString() nmid?: string;
  /** Which BRAND this payment method belongs to. Its outlets/agents route here. */
  @IsOptional() @IsInt() @IsPositive() brandId?: number;
  /** @deprecated superseded by brandId (1 owner → many brands). */
  @IsOptional() @IsInt() @IsPositive() ownerAdminId?: number;
}

export class UpdateQrisAccountDto {
  @IsOptional() @IsString() @MinLength(1) label?: string;
  /** Move this payment method to another BRAND; its outlets follow. */
  @IsOptional() @IsInt() @IsPositive() brandId?: number;
  /** @deprecated superseded by brandId. */
  @IsOptional() @IsInt() @IsPositive() ownerAdminId?: number;
  @IsOptional() @IsString() qrisText?: string;
  @IsOptional() @IsString() merchant?: string;
  @IsOptional() @IsString() nmid?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Mark this QRIS as the merchant that receives wallet top-ups (one per owner). */
  @IsOptional() @IsBoolean() isTopupDefault?: boolean;
  /** Amount mode for this merchant's QR (matches its QRIS registration capability). */
  @IsOptional()
  @IsIn(['dynamic', 'static-amount', 'static'], { message: 'Mode: dynamic, static-amount, atau static' })
  paymentMode?: 'dynamic' | 'static-amount' | 'static';
}

// ── GoBiz merchant connect ──
export class GobizPasswordLoginDto {
  @IsString() @MinLength(3) identifier!: string; // email or phone registered at GoBiz
  @IsString() @MinLength(1) password!: string;
}

export class GobizRequestOtpDto {
  @IsString()
  @Matches(/^[0-9+\-\s]{8,16}$/, { message: 'Nomor HP tidak valid' })
  phone!: string;
}

export class GobizVerifyOtpDto {
  @IsString() otpToken!: string;
  @IsString() @MinLength(4) otp!: string;
  @IsOptional() @IsString() phone?: string;
}

export class GobizRefreshTokenDto {
  @IsString() @MinLength(10) refreshToken!: string;
}

// ── BRIAPI (SNAP) merchant credentials for a QRIS account ──
export class UpdateQrisBriDto {
  @IsString() @MinLength(3) clientId!: string;
  /** Plaintext; stored AES-256-GCM encrypted. */
  @IsString() @MinLength(3) clientSecret!: string;
  /** RSA private key PEM; stored encrypted. */
  @IsString() @MinLength(20) privateKey!: string;
  @IsString() @MinLength(3) partnerId!: string;
  @IsString() @MinLength(3) merchantId!: string;
  @IsString() @MinLength(1) terminalId!: string;
  @IsString() @MinLength(2) channelId!: string;
  @IsOptional() @IsString() baseUrl?: string;
}

export class AssignQrisOutletsDto {
  /** Outlets (owned by this admin) that route their payments to this QRIS account. */
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  serverIds!: number[];
}

// ── Integrations: WhatsApp (per-owner) ──
export class UpdateWhatsappDto {
  /** Admin's own WhatsApp number (recipient/sender id). Empty string clears it. */
  @IsOptional()
  @IsString()
  @Matches(/^$|^[0-9+\-\s]{8,20}$/, { message: 'Nomor WhatsApp tidak valid' })
  waNumber?: string;

  @IsOptional() @IsString() waGatewayUrl?: string;
  /** Plaintext gateway API key; stored encrypted. Omit to keep current. */
  @IsOptional() @IsString() waGatewayKey?: string;
  /** Set true to clear the stored gateway key. */
  @IsOptional() @IsBoolean() clearKey?: boolean;
}

// ── Voucher format (per-outlet) ──
export class UpdateVoucherFormatDto {
  /** Character style of generated codes. */
  @IsOptional()
  @IsIn(['numeric', 'alphanumeric'], { message: 'Format: numeric atau alphanumeric' })
  voucherCharset?: 'numeric' | 'alphanumeric';

  /** USER_PASS = username≠password; USER_EQ_PASS = password sama dengan username. */
  @IsOptional()
  @IsIn(['USER_PASS', 'USER_EQ_PASS'], { message: 'Mode: USER_PASS atau USER_EQ_PASS' })
  voucherUserMode?: 'USER_PASS' | 'USER_EQ_PASS';

  /** Code length per field (4–12). */
  @IsOptional() @IsInt() @Min(4) @Max(12) voucherLength?: number;
}

// ── Customers ──
export class OwnerCustomerTopupDto {
  @IsOptional() @IsInt() @IsPositive() customerId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor tidak valid' })
  phone?: string;

  @IsInt() @IsPositive() amount!: number;

  @IsOptional() @IsString() note?: string;
}

// ── Customer CRUD ──
export class CreateCustomerDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsString() @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor HP tidak valid' }) phone!: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9._]{3,20}$/, { message: 'Username 3-20 huruf kecil/angka/._' }) username?: string;
  @IsString() @MinLength(6) password!: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsString() @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor HP tidak valid' }) phone?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9._]{3,20}$/, { message: 'Username 3-20 huruf kecil/angka/._' }) username?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
