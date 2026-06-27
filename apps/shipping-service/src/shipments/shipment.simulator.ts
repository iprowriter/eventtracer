import { createHash } from 'node:crypto';

/** Carriers we can "dispatch" to. Order is fixed so the choice is stable. */
const CARRIERS = ['DHL', 'Hermes', 'DPD', 'UPS', 'GLS', 'FedEx'] as const;

/**
 * Pick a carrier DETERMINISTICALLY (specs.md "seeded outcomes"). Same idea as
 * the payment simulator: a pure function of the orderId seed, never Math.random,
 * so every replay of the same order routes to the same carrier.
 */
export function chooseCarrier(orderId: string): string {
  const firstByte = createHash('sha256').update(orderId).digest()[0]; // 0..255
  return CARRIERS[firstByte % CARRIERS.length];
}
