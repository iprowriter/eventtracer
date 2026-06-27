import { EventEnvelope } from './envelope';

/** Payload for the `shipment.created` event. */
export interface ShipmentCreatedPayload {
  orderId: string;
  /** Id minted by shipping-service for this shipment. */
  shipmentId: string;
  /** Carrier handling the shipment (deterministically chosen). */
  carrier: string;
}

/** A fully-typed `shipment.created` event (envelope + its payload). */
export type ShipmentCreatedEvent = EventEnvelope<ShipmentCreatedPayload>;
