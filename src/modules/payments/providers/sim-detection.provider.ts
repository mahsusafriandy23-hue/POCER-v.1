import { Injectable } from '@nestjs/common';
import {
  PaymentDetectionProvider,
  Settlement,
} from '../payment-detection.interface';

/**
 * Simulator detection provider — an in-memory settlement store you push to (dev/tests).
 * Lets us prove matching, refund-exclusion, late-payment and orphan handling with zero
 * external dependency.
 */
@Injectable()
export class SimDetectionProvider implements PaymentDetectionProvider {
  readonly name = 'sim';
  private settlements: Settlement[] = [];

  push(s: Settlement): void {
    this.settlements.push({
      grossAmount: s.grossAmount,
      status: s.status || 'settlement',
      externalId: s.externalId,
      time: s.time || new Date().toISOString(),
    });
  }

  clear(): void {
    this.settlements = [];
  }

  async listSettlements(_sinceMs: number): Promise<Settlement[]> {
    return [...this.settlements];
  }
}
