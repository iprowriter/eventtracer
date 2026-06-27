import { EventEnvelope } from './envelope';

/** Payload for the `payment.succeeded` event. */
export interface PaymentSucceededPayload {
  orderId: string;
  /** Id minted by payment-service for this payment. */
  paymentId: string;
  amount: number;
}

/** A fully-typed `payment.succeeded` event (envelope + its payload). */
export type PaymentSucceededEvent = EventEnvelope<PaymentSucceededPayload>;

/** Payload for the `payment.failed` event. */
export interface PaymentFailedPayload {
  orderId: string;
  amount: number;
  /** Human-readable reason the payment was declined. */
  reason: string;
}

/** A fully-typed `payment.failed` event (envelope + its payload). */
export type PaymentFailedEvent = EventEnvelope<PaymentFailedPayload>;
