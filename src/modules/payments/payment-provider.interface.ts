/**
 * Payment provider PORT (Anti-Corruption Layer over a QRIS source).
 * The "sim" adapter mirrors the legacy QRIS2 service behavior (unique-amount + QR)
 * without any external dependency. A future "gobiz" adapter implements the same
 * contract against api.gobiz.co.id (PAYMENT_FLOW.md), so the core never changes.
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface BuildQrInput {
  reference: string;
  originalAmount: number;
  totalAmount: number;
  ttlMs: number;
  /**
   * Per-outlet QRIS payload, resolved from the order's outlet (Server.qrisAccountId).
   * When present the QR is built from THIS merchant; otherwise the provider falls
   * back to its global QRIS_TEXT/synthetic template.
   */
  qrisText?: string;
  /**
   * Per-account amount mode (QrisAccount.paymentMode): 'dynamic' | 'static-amount' | 'static'.
   * Overrides the provider's global QRIS_AMOUNT_MODE for this merchant. Some merchants only
   * accept a plain static QR interbank; an amount-bearing one is rejected ("merchant not found").
   */
  paymentMode?: string | null;
  /** Decrypted BRIAPI credentials when the resolved QRIS account uses provider 'bri'. */
  bri?: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    privateKey: string;
    partnerId: string;
    merchantId: string;
    terminalId: string;
    channelId: string;
  } | null;
}

export interface BuiltQr {
  qrUrl: string;
  /** Raw QRIS/EMV payload if applicable (sim returns a synthetic string). */
  payload?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** Build the payable QR for an already-reserved unique total amount. */
  buildQr(input: BuildQrInput): Promise<BuiltQr>;
}
