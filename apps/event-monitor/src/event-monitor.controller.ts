import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { type DeadLetter, type EventEnvelope, Topics, dlq } from '@app/events';
import { EventMonitorGateway } from './event-monitor.gateway';

@Controller()
export class EventMonitorController {
  private readonly logger = new Logger(EventMonitorController.name);

  constructor(private readonly gateway: EventMonitorGateway) {}

  // As each service comes online we add one @EventPattern per topic here — the
  // monitor is the ONE place allowed to read every topic (ADR-002, rule #3). We
  // subscribe only to topics that actually exist to avoid "unknown topic" noise
  // from kafkajs. All handlers do the same thing: log + broadcast the envelope.
  @EventPattern(Topics.OrderCreated)
  handleOrderCreated(@Payload() envelope: EventEnvelope) {
    this.broadcast(envelope);
  }

  @EventPattern(Topics.PaymentSucceeded)
  handlePaymentSucceeded(@Payload() envelope: EventEnvelope) {
    this.broadcast(envelope);
  }

  @EventPattern(Topics.PaymentFailed)
  handlePaymentFailed(@Payload() envelope: EventEnvelope) {
    this.broadcast(envelope);
  }

  @EventPattern(Topics.ShipmentCreated)
  handleShipmentCreated(@Payload() envelope: EventEnvelope) {
    this.broadcast(envelope);
  }

  @EventPattern(Topics.NotificationSent)
  handleNotificationSent(@Payload() envelope: EventEnvelope) {
    this.broadcast(envelope);
  }

  @EventPattern(Topics.RefundInitiated)
  handleRefundInitiated(@Payload() envelope: EventEnvelope) {
    this.broadcast(envelope);
  }

  // Dead letters land here (ADR-007). We subscribe to the DLQ of every topic a
  // consumer can poison; for now that's order.created (payment-service). The
  // value is a DeadLetter wrapper, not an envelope — the gateway reshapes it.
  @EventPattern(dlq(Topics.OrderCreated))
  handleOrderCreatedDlq(@Payload() deadLetter: DeadLetter) {
    this.logger.warn(
      `[DLQ ${dlq(deadLetter.originalTopic)}] correlationId=${deadLetter.original.correlationId} after ${deadLetter.attempts} attempts: ${deadLetter.error}`,
    );
    this.gateway.broadcastDeadLetter(deadLetter);
  }

  private broadcast(envelope: EventEnvelope) {
    this.logger.log(
      `[${envelope.eventType}] correlationId=${envelope.correlationId} eventId=${envelope.eventId}`,
    );
    this.gateway.broadcast(envelope);
  }
}
