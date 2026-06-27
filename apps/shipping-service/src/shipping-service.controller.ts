import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { type PaymentSucceededEvent, Topics } from '@app/events';
import { ShipmentsService } from './shipments/shipments.service';

@Controller()
export class ShippingServiceController {
  private readonly logger = new Logger(ShippingServiceController.name);

  constructor(private readonly shipmentsService: ShipmentsService) {}

  // shipping-service is its OWN consumer group on payment.succeeded — note it
  // does NOT subscribe to payment.failed, so a declined order produces no
  // shipment. The message value is the full envelope; we hand the payload on.
  @EventPattern(Topics.PaymentSucceeded)
  async handlePaymentSucceeded(
    @Payload() envelope: PaymentSucceededEvent,
  ): Promise<void> {
    this.logger.log(
      `Received ${Topics.PaymentSucceeded} for order ${envelope.correlationId}`,
    );
    await this.shipmentsService.handlePaymentSucceeded(envelope.payload);
  }
}
