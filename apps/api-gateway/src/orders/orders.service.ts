import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import {
  Commands,
  CreateOrderCommand,
  RedeliverOrderCommand,
} from '@app/events';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    // Connect the producer once at startup so the first POST doesn't pay the
    // connection cost — and we fail fast if the broker is unreachable.
    await this.orderClient.connect();
  }

  async createOrder(
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<{ orderId: string }> {
    const orderId = randomUUID(); // becomes the saga correlationId

    const command: CreateOrderCommand = {
      orderId,
      items: dto.items,
      amount: dto.amount,
      idempotencyKey,
    };

    // Hand off to the order-service over Kafka (ADR-003: no synchronous call).
    // emit() is fire-and-forget. We await the produce so a broker problem
    // surfaces as a failed request instead of a false 202.
    await firstValueFrom(this.orderClient.emit(Commands.CreateOrder, command));

    this.logger.log(
      `Forwarded ${Commands.CreateOrder} for order ${orderId} ` +
        `(items=${dto.items.length}, amount=${dto.amount})`,
    );
    return { orderId };
  }

  /**
   * Ask the order-service to re-publish an existing order's `order.created` (the
   * idempotency demo, specs §7). Like createOrder this is a fire-and-forget Kafka
   * command — the gateway never republishes the domain event itself (rules #1, #4).
   */
  async redeliverOrder(orderId: string): Promise<{ orderId: string }> {
    const command: RedeliverOrderCommand = { orderId };
    await firstValueFrom(
      this.orderClient.emit(Commands.RedeliverOrder, command),
    );
    this.logger.log(
      `Forwarded ${Commands.RedeliverOrder} for order ${orderId}`,
    );
    return { orderId };
  }
}
