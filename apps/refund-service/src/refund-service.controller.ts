import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { type PaymentFailedEvent, Topics } from '@app/events';
import { RefundsService } from './refunds/refunds.service';

@Controller()
export class RefundServiceController {
  private readonly logger = new Logger(RefundServiceController.name);

  constructor(private readonly refundsService: RefundsService) {}

  // refund-service is the failure-branch twin of shipping: its own consumer
  // group subscribes to payment.failed ONLY (the branch shipping ignores) and
  // runs the saga's compensating action. The value is the full envelope; we
  // hand the inner payload on.
  @EventPattern(Topics.PaymentFailed)
  async handlePaymentFailed(
    @Payload() envelope: PaymentFailedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received ${Topics.PaymentFailed} for order ${envelope.correlationId}`,
    );
    await this.refundsService.handlePaymentFailed(envelope.payload);
  }
}
