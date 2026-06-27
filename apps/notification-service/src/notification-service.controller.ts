import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { type EventEnvelope, Topics } from '@app/events';
import { NotificationsService } from './notifications/notifications.service';

@Controller()
export class NotificationServiceController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // notification-service is a terminal SINK: its own consumer group subscribes
  // to every customer-relevant topic and produces nothing back. Each handler
  // does the same thing — hand the full envelope to the service, which renders
  // and "sends" the message. (If we add refund.initiated later, add one line.)

  @EventPattern(Topics.OrderCreated)
  handleOrderCreated(@Payload() envelope: EventEnvelope) {
    return this.notificationsService.notify(envelope);
  }

  @EventPattern(Topics.PaymentSucceeded)
  handlePaymentSucceeded(@Payload() envelope: EventEnvelope) {
    return this.notificationsService.notify(envelope);
  }

  @EventPattern(Topics.PaymentFailed)
  handlePaymentFailed(@Payload() envelope: EventEnvelope) {
    return this.notificationsService.notify(envelope);
  }

  @EventPattern(Topics.ShipmentCreated)
  handleShipmentCreated(@Payload() envelope: EventEnvelope) {
    return this.notificationsService.notify(envelope);
  }

  @EventPattern(Topics.RefundInitiated)
  handleRefundInitiated(@Payload() envelope: EventEnvelope) {
    return this.notificationsService.notify(envelope);
  }
}
