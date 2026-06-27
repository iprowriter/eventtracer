import {
  EventEnvelope,
  PaymentFailedPayload,
  PaymentSucceededPayload,
  ShipmentCreatedPayload,
  Topics,
} from '@app/events';
import { NotificationChannel } from './notification.entity';

export interface RenderedNotification {
  channel: NotificationChannel;
  message: string;
}

/**
 * Turn an event into the message we'd "send" — a PURE function of the envelope
 * (no I/O, no Date.now), so it's easy to unit-test and deterministic. This is
 * the whole job of a notification sink: translate domain events into customer
 * language. We never mutate state or publish anything here.
 */
export function renderNotification(
  envelope: EventEnvelope,
): RenderedNotification {
  const { orderId } = envelope.payload as { orderId: string };

  switch (envelope.eventType) {
    case Topics.OrderCreated: {
      return {
        channel: 'EMAIL',
        message: `Order ${orderId} received — thanks!`,
      };
    }
    case Topics.PaymentSucceeded: {
      const { amount } = envelope.payload as PaymentSucceededPayload;
      return {
        channel: 'EMAIL',
        message: `Payment of $${amount} confirmed for order ${orderId}.`,
      };
    }
    case Topics.PaymentFailed: {
      const { reason } = envelope.payload as PaymentFailedPayload;
      return {
        channel: 'EMAIL',
        message: `Payment failed for order ${orderId}: ${reason}`,
      };
    }
    case Topics.ShipmentCreated: {
      const { carrier } = envelope.payload as ShipmentCreatedPayload;
      return {
        channel: 'SMS',
        message: `Your order ${orderId} has shipped via ${carrier}.`,
      };
    }
    default: {
      // We only subscribe to the four topics above, so this is unreachable in
      // practice — but a sink should degrade gracefully rather than crash the
      // consumer on an unexpected event.
      return { channel: 'EMAIL', message: `Update for order ${orderId}.` };
    }
  }
}
