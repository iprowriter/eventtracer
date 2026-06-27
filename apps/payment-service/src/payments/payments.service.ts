import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  EventEnvelope,
  OrderCreatedPayload,
  PaymentFailedPayload,
  PaymentSucceededPayload,
  Topics,
} from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Payment } from './payment.entity';
import { decidePaymentOutcome } from './payment.simulator';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // Same idea as OrdersService: inject the DataSource so the payment row and the
  // outbox row commit in ONE transaction (ADR-004).
  constructor(private readonly dataSource: DataSource) {}

  async handleOrderCreated(order: OrderCreatedPayload): Promise<void> {
    // DLQ demo (ADR-007): an item with sku 'POISON' simulates an order this
    // service can NEVER process (a permanent error). It throws on EVERY attempt,
    // so the controller's retry-then-DLQ wrapper routes it to order.created.DLQ
    // after N tries instead of blocking the partition forever. Thrown BEFORE the
    // transaction opens, so failed attempts leave no partial state.
    if (order.items.some((item) => item.sku === 'POISON')) {
      throw new Error(`Unprocessable order ${order.orderId}: POISON sku`);
    }

    await this.dataSource.transaction(async (manager) => {
      const payments = manager.getRepository(Payment);
      const outbox = manager.getRepository(OutboxMessage);

      // Idempotency (ADR-006): a redelivered order.created is a no-op.
      const existing = await payments.findOne({
        where: { orderId: order.orderId },
      });
      if (existing) {
        this.logger.warn(
          `Payment for order ${order.orderId} already processed — skipping (duplicate delivery)`,
        );
        return;
      }

      // Deterministic decision — same orderId always resolves the same way.
      const outcome = decidePaymentOutcome(order.orderId);
      const paymentId = randomUUID();
      const reason = outcome === 'FAILED' ? 'Card declined (simulated)' : null;

      // (1) business state
      await payments.save(
        payments.create({
          orderId: order.orderId,
          paymentId,
          amount: order.amount,
          status: outcome,
          reason,
        }),
      );

      // (2) the event — picked from the outcome, frozen in the SAME tx. The
      // relay publishes it later; we never produce to Kafka here (ADR-004).
      const topic =
        outcome === 'SUCCEEDED'
          ? Topics.PaymentSucceeded
          : Topics.PaymentFailed;
      const payload: PaymentSucceededPayload | PaymentFailedPayload =
        outcome === 'SUCCEEDED'
          ? { orderId: order.orderId, paymentId, amount: order.amount }
          : { orderId: order.orderId, amount: order.amount, reason: reason! };

      const event: EventEnvelope = {
        eventId: randomUUID(),
        eventType: topic,
        occurredAt: new Date().toISOString(),
        correlationId: order.orderId, // same saga id → groups with order.created
        version: 1,
        payload,
      };
      await outbox.save(
        outbox.create({
          topic,
          key: order.orderId, // partition key — saga events stay ordered
          payload: event,
        }),
      );

      this.logger.log(
        `Payment ${outcome} for order ${order.orderId} + outbox(${topic}) in one tx`,
      );
    });
  }
}
