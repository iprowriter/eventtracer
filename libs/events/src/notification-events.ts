import { EventEnvelope } from './envelope';

/** Payload for the `notification.sent` event. */
export interface NotificationSentPayload {
  orderId: string;
  /** Id minted by notification-service for this notification. */
  notificationId: string;
  /** Which channel the (simulated) message went out on. */
  channel: 'EMAIL' | 'SMS';
  /** The customer-facing message body. */
  message: string;
  /** The event type that triggered this notification, e.g. 'shipment.created'. */
  triggeredBy: string;
}

/** A fully-typed `notification.sent` event (envelope + its payload). */
export type NotificationSentEvent = EventEnvelope<NotificationSentPayload>;
