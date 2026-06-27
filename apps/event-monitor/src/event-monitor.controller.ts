import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { type EventEnvelope, Topics } from '@app/events';
import { EventMonitorGateway } from './event-monitor.gateway';

@Controller()
export class EventMonitorController {
  private readonly logger = new Logger(EventMonitorController.name);

  constructor(private readonly gateway: EventMonitorGateway) {}

  // For now only order.created exists. As each service comes online we add one
  // @EventPattern per topic here — the monitor is the ONE place allowed to read
  // every topic (ADR-002, rule #3). We subscribe only to topics that actually
  // exist to avoid "unknown topic" noise from kafkajs.
  @EventPattern(Topics.OrderCreated)
  handleOrderCreated(@Payload() envelope: EventEnvelope) {
    this.logger.log(
      `[${envelope.eventType}] correlationId=${envelope.correlationId} eventId=${envelope.eventId}`,
    );
    this.gateway.broadcast(envelope);
  }
}
