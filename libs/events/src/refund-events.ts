import { EventEnvelope } from './envelope';

/** Payload for the `refund.initiated` event (the saga's compensating action). */
export interface RefundInitiatedPayload {
  orderId: string;
  /** Id minted by refund-service for this refund. */
  refundId: string;
  /** Amount being refunded — equals the failed payment's amount. */
  amount: number;
}

/** A fully-typed `refund.initiated` event (envelope + its payload). */
export type RefundInitiatedEvent = EventEnvelope<RefundInitiatedPayload>;
