import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  EventEnvelope,
  PaymentFailedPayload,
  RefundInitiatedPayload,
  Topics,
} from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Refund } from './refund.entity';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  // Same producer pattern as payment/shipping: the refund row and the outbox
  // row commit in ONE transaction (ADR-004). This is the saga's COMPENSATING
  // transaction — it runs only on the failure branch.
  constructor(private readonly dataSource: DataSource) {}

  async handlePaymentFailed(payment: PaymentFailedPayload): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const refunds = manager.getRepository(Refund);
      const outbox = manager.getRepository(OutboxMessage);

      // Idempotency (ADR-006): a redelivered payment.failed is a no-op.
      const existing = await refunds.findOne({
        where: { orderId: payment.orderId },
      });
      if (existing) {
        this.logger.warn(
          `Refund for order ${payment.orderId} already initiated — skipping (duplicate delivery)`,
        );
        return;
      }

      const refundId = randomUUID();

      // (1) business state — the refund we're starting
      await refunds.save(
        refunds.create({
          orderId: payment.orderId,
          refundId,
          amount: payment.amount,
        }),
      );

      // (2) the event, frozen in the SAME tx; the relay publishes it later.
      const payload: RefundInitiatedPayload = {
        orderId: payment.orderId,
        refundId,
        amount: payment.amount,
      };
      const event: EventEnvelope = {
        eventId: randomUUID(),
        eventType: Topics.RefundInitiated,
        occurredAt: new Date().toISOString(),
        correlationId: payment.orderId, // same saga id → groups with the rest
        version: 1,
        payload,
      };
      await outbox.save(
        outbox.create({
          topic: Topics.RefundInitiated,
          key: payment.orderId, // partition key — saga events stay ordered
          payload: event,
        }),
      );

      this.logger.log(
        `Refund of $${payment.amount} initiated for order ${payment.orderId} + outbox(${Topics.RefundInitiated}) in one tx`,
      );
    });
  }
}
