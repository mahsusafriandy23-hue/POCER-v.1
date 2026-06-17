/**
 * Payment DETECTION port (ACL over GoBiz transaction history).
 * Returns merchant settlements so the reconciler can match payments by unique amount.
 * The "sim" adapter holds an in-memory list (deterministic tests); the "gobiz" adapter
 * polls a configurable journals/search-shaped endpoint. Pull-based, mirrors PAYMENT_FLOW §5.
 */
export const PAYMENT_DETECTION = Symbol('PAYMENT_DETECTION');

export interface Settlement {
  grossAmount: number; // integer rupiah
  status: string; // settlement | capture | refund | partial_refund | ...
  externalId?: string;
  time?: string; // ISO; used for the time-guard against reused amounts (E5)
}

export interface PaymentDetectionProvider {
  readonly name: string;
  /** Recent settlements within the lookback window (ms). */
  listSettlements(sinceMs: number): Promise<Settlement[]>;
}
