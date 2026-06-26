import { Topic } from './topics';

/**
 * The shared event envelope. EVERY event on EVERY topic has this shape
 * (specs.md §5). The generic <T> is the event-specific payload.
 */

export interface EventEnvelope<T = unknown> {
  /** Unique id for THIS event. Used as the idempotency dedup key (ADR-006). */
  eventId: string;
  /** Which kind of event this is — matches the topic name, e.g. 'order.created'. */
  eventType: Topic;
  /** ISO-8601 timestamp of when the fact occurred. */
  occurredAt: string;
  /** The saga/order id. Groups every event of one run together in the UI. Always set it. */
  correlationId: string;
  /** Schema version of the payload, for future evolution. */
  version: number;
  /** Event-specific data. */
  payload: T;
}
