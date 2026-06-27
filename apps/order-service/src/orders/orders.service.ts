import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  CreateOrderCommand,
  EventEnvelope,
  OrderCreatedPayload,
  Topics,
} from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Order } from './order.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  // Inject the DataSource so we can open a transaction spanning BOTH tables.
  constructor(private readonly dataSource: DataSource) {}

  async createOrder(command: CreateOrderCommand): Promise<void> {
    // Everything inside this callback is ONE transaction: it commits only if the
    // callback resolves, and rolls back entirely if anything throws. So the order
    // row and the outbox row land together — or not at all (ADR-004).
    await this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(Order);
      const outbox = manager.getRepository(OutboxMessage);

      // Idempotency (ADR-006): redelivery of the same command is a no-op.
      const existing = await orders.findOne({ where: { id: command.orderId } });
      if (existing) {
        this.logger.warn(
          `Order ${command.orderId} already exists — skipping (duplicate delivery)`,
        );
        return;
      }

      // (1) business state
      await orders.save(
        orders.create({
          id: command.orderId,
          items: command.items,
          amount: command.amount,
          status: 'CREATED',
        }),
      );

      // (2) the event — frozen as a row, in the SAME transaction. NOT sent to
      // Kafka here; the relay will publish it later (5.5).
      const event: EventEnvelope<OrderCreatedPayload> = {
        eventId: randomUUID(),
        eventType: Topics.OrderCreated,
        occurredAt: new Date().toISOString(),
        correlationId: command.orderId, // groups the whole saga in the UI
        version: 1,
        payload: {
          orderId: command.orderId,
          items: command.items,
          amount: command.amount,
        },
      };
      await outbox.save(
        outbox.create({
          topic: Topics.OrderCreated,
          key: command.orderId, // partition key — saga events stay ordered
          payload: event,
        }),
      );

      this.logger.log(
        `Persisted order ${command.orderId} + outbox(order.created) in one tx`,
      );
    });
  }
}
