import { createHash } from 'node:crypto';
import { PaymentStatus } from './payment.entity';

/** Percentage of payments that are declined. */
const FAILURE_RATE = 20;

/**
 * Decide a payment's outcome DETERMINISTICALLY (specs.md "seeded outcomes").
 *
 * Real gateways are random; a random demo can't be replayed. So instead of
 * Math.random() we make the outcome a pure function of the orderId (the seed):
 * hash it, take a stable number in 0..99, and split on a fixed threshold. The
 * same orderId therefore always yields the same result, every replay.
 */
export function decidePaymentOutcome(orderId: string): PaymentStatus {
  const firstByte = createHash('sha256').update(orderId).digest()[0]; // 0..255
  return firstByte % 100 < FAILURE_RATE ? 'FAILED' : 'SUCCEEDED';
}
