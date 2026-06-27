import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientKafka, EventPattern, Payload } from '@nestjs/microservices';
import { type OrderCreatedEvent, Topics } from '@app/events';
import { processWithDlq } from '@app/kafka';
import { OUTBOX_PRODUCER } from '@app/outbox';
import { PaymentsService } from './payments/payments.service';

@Controller()
export class PaymentServiceController {
  private readonly logger = new Logger(PaymentServiceController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    // The same producer the relay publishes through — reused here to route
    // poison messages to the DLQ (already connected by the relay).
    @Inject(OUTBOX_PRODUCER) private readonly producer: ClientKafka,
  ) {}

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
