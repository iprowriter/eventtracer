/**
 * Kafka command names + payloads. A COMMAND is imperative — a request to DO
 * something ("create this order") — as opposed to an event, which is a
 * past-tense fact ("order.created"). The browser's intent enters as a command
 * (ADR-001); the gateway forwards it to the owning service over Kafka, never via
 * a synchronous call (ADR-003).
 *
 * Like Topics, these strings live ONLY here so the gateway and the
 * order-service can never drift (rule #7).
 */
export const Commands = {
  CreateOrder: 'order.create',
  RedeliverOrder: 'order.redeliver',
} as const;

/** A valid command name, e.g. 'order.create'. */
export type Command = (typeof Commands)[keyof typeof Commands];

/** Payload the gateway hands the order-service to start a saga. */
export interface CreateOrderCommand {
  /** Saga/order id minted by the gateway — becomes the run's correlationId. */
  orderId: string;
  items: { sku: string; quantity: number }[];
  amount: number;
  /** Optional client-supplied key for end-to-end idempotency. */
  idempotencyKey?: string;
}

/**
 * Re-publish an existing order's `order.created` (the duplicate-delivery /
 * idempotency demo, specs §7). The order-service re-emits the IDENTICAL envelope
 * (same eventId), so every consumer dedupes it to a no-op — no second charge,
 * no second notification.
 */
export interface RedeliverOrderCommand {
  orderId: string;
}
