import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { type OrderCreatedEvent, Topics } from '@app/events';
import { PaymentsService } from './payments/payments.service';

@Controller()
export class PaymentServiceController {
  private readonly logger = new Logger(PaymentServiceController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

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
    await this.paymentsService.handleOrderCreated(envelope.payload);
  }
}
