/**
 * Kafka topic names. Lowercase dotted, past tense (see CLAUDE.md conventions).
 * These are the ONLY place topic strings are defined — never hardcode a topic
 * name inside a service (ADR-009, inviolable rule #7).
 */
export const Topics = {
  OrderCreated: 'order.created',
  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  ShipmentCreated: 'shipment.created',
  RefundInitiated: 'refund.initiated',
  NotificationSent: 'notification.sent',
} as const;

/** A valid topic name, e.g. 'order.created'. Derived from Topics so the two never drift. */
export type Topic = (typeof Topics)[keyof typeof Topics];

/** Dead-letter topic for a given topic, e.g. dlq('order.created') === 'order.created.DLQ'. */
export const dlq = (topic: Topic): string => `${topic}.DLQ`;
