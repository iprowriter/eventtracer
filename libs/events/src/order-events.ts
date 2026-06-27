import { EventEnvelope } from './envelope';

/** Payload for the `order.created` event. */
export interface OrderCreatedPayload {
  orderId: string;
  items: { sku: string; quantity: number }[];
  amount: number;
}

/** A fully-typed `order.created` event (envelope + its payload). */
export type OrderCreatedEvent = EventEnvelope<OrderCreatedPayload>;
