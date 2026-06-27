import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  Commands,
  type CreateOrderCommand,
  type RedeliverOrderCommand,
} from '@app/events';
import { OrdersService } from './orders/orders.service';

@Controller()
export class OrderServiceController {
  private readonly logger = new Logger(OrderServiceController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @EventPattern(Commands.CreateOrder)
  async handleCreateOrder(
    @Payload() command: CreateOrderCommand,
  ): Promise<void> {
    this.logger.log(
      `Received ${Commands.CreateOrder} for order ${command.orderId}`,
    );
    await this.ordersService.createOrder(command);
  }

  @EventPattern(Commands.RedeliverOrder)
  async handleRedeliverOrder(
    @Payload() command: RedeliverOrderCommand,
  ): Promise<void> {
    this.logger.log(
      `Received ${Commands.RedeliverOrder} for order ${command.orderId}`,
    );
    await this.ordersService.redeliver(command.orderId);
  }
}
