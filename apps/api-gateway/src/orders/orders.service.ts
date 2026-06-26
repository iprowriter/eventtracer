import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  createOrder(
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): { orderId: string } {
    const orderId = randomUUID();
    this.logger.log(
      `Accepted order ${orderId} (idempotencyKey=${idempotencyKey ?? 'none'}, items=${dto.items.length}, amount=${dto.amount})`,
    );
    // TODO Step 5: forward to Order Service → it persists the order + outbox row,
    // and the relay publishes `order.created`. The gateway never touches Kafka.
    return { orderId };
  }
}
