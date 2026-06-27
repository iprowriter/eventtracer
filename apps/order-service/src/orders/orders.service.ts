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

  /**
   * Re-publish an order's original `order.created` — the duplicate-delivery /
   * idempotency demo (specs §7, rule #5). We read the row we first wrote to the
   * outbox and queue a NEW outbox row carrying the SAME envelope (same eventId).
   * The relay republishes it verbatim, so the consumers see a genuine
   * at-least-once redelivery: payment dedupes on orderId, notification on the
   * consumed eventId — both no-op, so no second charge and no second email.
   *
   * order.created is OWNED by this service, so re-emitting it here (via the
   * outbox, rule #4) is the only correct place — the gateway/browser must not
   * republish a domain event themselves (rules #1, #4).
   */
  async redeliver(orderId: string): Promise<void> {
    const outbox = this.dataSource.getRepository(OutboxMessage);

    // The first order.created we ever emitted for this order.
    const original = await outbox.findOne({
      where: { topic: Topics.OrderCreated, key: orderId },
      order: { createdAt: 'ASC' },
    });
    if (!original) {
      this.logger.warn(
        `Cannot redeliver ${Topics.OrderCreated} for ${orderId} — no original outbox row found`,
      );
      return;
    }

    // A fresh outbox row (own id, publishedAt NULL) with the IDENTICAL payload.
    await outbox.save(
      outbox.create({
        topic: original.topic,
        key: original.key,
        payload: original.payload, // same envelope → same eventId
      }),
    );

    const envelope = original.payload as EventEnvelope<OrderCreatedPayload>;
    this.logger.log(
      `Re-queued ${Topics.OrderCreated} for ${orderId} (same eventId=${envelope.eventId}) — consumers should dedupe it`,
    );
  }
}
