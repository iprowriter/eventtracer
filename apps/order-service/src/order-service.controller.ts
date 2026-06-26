import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Commands, type CreateOrderCommand } from '@app/events';

@Controller()
export class OrderServiceController {
  private readonly logger = new Logger(OrderServiceController.name);

  @EventPattern(Commands.CreateOrder)
  handleCreateOrder(@Payload() command: CreateOrderCommand): void {
    this.logger.log(
      `Received ${Commands.CreateOrder} for order ${command.orderId} ` +
        `(items=${command.items.length}, amount=${command.amount}, ` +
        `idempotencyKey=${command.idempotencyKey ?? 'none'})`,
    );
    // TODO (next bites): persist order + outbox row in ONE tx;
    // the relay then publishes `order.created`.
  }
}
