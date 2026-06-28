import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientKafka, EventPattern, Payload } from '@nestjs/microservices';
import {
  type ConsumerControlCommand,
  ControlTopic,
  type OrderCreatedEvent,
  Topics,
} from '@app/events';
import { ConsumerControl, processWithDlq } from '@app/kafka';
import { OUTBOX_PRODUCER } from '@app/outbox';
import { PaymentsService } from './payments/payments.service';

/** This service's name as it appears in control messages (ADR-014). */
const SERVICE = 'payment-service';

@Controller()
export class PaymentServiceController {
  private readonly logger = new Logger(PaymentServiceController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    // The same producer the relay publishes through — reused here to route
    // poison messages to the DLQ (already connected by the relay).
    @Inject(OUTBOX_PRODUCER) private readonly producer: ClientKafka,
    private readonly consumerControl: ConsumerControl,
  ) {}

  // Kill-a-consumer (ADR-014): every controllable service listens on the shared
  // control topic and acts only on messages addressed to it. Pausing affects the
  // DOMAIN topic only, so these control messages keep arriving and resume works.
  @EventPattern(ControlTopic)
  handleControl(@Payload() cmd: ConsumerControlCommand): void {
    if (cmd.service !== SERVICE) return;
    this.logger.warn(`Control: ${cmd.action} requested for ${SERVICE}`);
    this.consumerControl.apply(cmd.action);
  }

  // payment-service is a NEW consumer group on order.created — it receives every
  // order.created independently of order-service. The message value is the full
  // envelope (the relay publishes envelopes), so we hand the inner payload on.
  @EventPattern(Topics.OrderCreated)
  async handleOrderCreated(
    @Payload() envelope: OrderCreatedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received ${Topics.OrderCreated} for order ${envelope.correlationId}`,
    );
    // Retry-then-DLQ (ADR-007): if processing fails permanently (e.g. a POISON
    // order), the message is retried N times then routed to order.created.DLQ so
    // it never blocks the partition. Normal orders just process on attempt 1.
    await processWithDlq(
      envelope,
      {
        topic: Topics.OrderCreated,
        producer: this.producer,
        retries: 3,
        logger: this.logger,
      },
      () => this.paymentsService.handleOrderCreated(envelope.payload),
    );
  }
}
