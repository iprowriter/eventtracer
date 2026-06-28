import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  type ConsumerControlCommand,
  ControlTopic,
  type PaymentSucceededEvent,
  Topics,
} from '@app/events';
import { ConsumerControl } from '@app/kafka';
import { ShipmentsService } from './shipments/shipments.service';

/** This service's name as it appears in control messages (ADR-014). */
const SERVICE = 'shipping-service';

@Controller()
export class ShippingServiceController {
  private readonly logger = new Logger(ShippingServiceController.name);

  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly consumerControl: ConsumerControl,
  ) {}

  // Kill-a-consumer (ADR-014): act only on control messages addressed to us.
  @EventPattern(ControlTopic)
  handleControl(@Payload() cmd: ConsumerControlCommand): void {
    if (cmd.service !== SERVICE) return;
    this.logger.warn(`Control: ${cmd.action} requested for ${SERVICE}`);
    this.consumerControl.apply(cmd.action);
  }

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
