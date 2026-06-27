import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  EventEnvelope,
  PaymentSucceededPayload,
  ShipmentCreatedPayload,
  Topics,
} from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Shipment } from './shipment.entity';
import { chooseCarrier } from './shipment.simulator';

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  // Same pattern as PaymentsService: inject the DataSource so the shipment row
  // and the outbox row commit in ONE transaction (ADR-004).
  constructor(private readonly dataSource: DataSource) {}

  async handlePaymentSucceeded(
    payment: PaymentSucceededPayload,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const shipments = manager.getRepository(Shipment);
      const outbox = manager.getRepository(OutboxMessage);

      // Idempotency (ADR-006): a redelivered payment.succeeded is a no-op.
      const existing = await shipments.findOne({
        where: { orderId: payment.orderId },
      });
      if (existing) {
        this.logger.warn(
          `Shipment for order ${payment.orderId} already created — skipping (duplicate delivery)`,
        );
        return;
      }

      // Deterministic carrier — same orderId always routes the same way.
      const carrier = chooseCarrier(payment.orderId);
      const shipmentId = randomUUID();

      // (1) business state
      await shipments.save(
        shipments.create({ orderId: payment.orderId, shipmentId, carrier }),
      );

      // (2) the event, frozen in the SAME tx. The relay publishes it later; we
      // never produce to Kafka here (ADR-004).
      const payload: ShipmentCreatedPayload = {
        orderId: payment.orderId,
        shipmentId,
        carrier,
      };
      const event: EventEnvelope = {
        eventId: randomUUID(),
        eventType: Topics.ShipmentCreated,
        occurredAt: new Date().toISOString(),
        correlationId: payment.orderId, // same saga id → groups with the rest
        version: 1,
        payload,
      };
      await outbox.save(
        outbox.create({
          topic: Topics.ShipmentCreated,
          key: payment.orderId, // partition key — saga events stay ordered
          payload: event,
        }),
      );

      this.logger.log(
        `Shipment created for order ${payment.orderId} via ${carrier} + outbox(${Topics.ShipmentCreated}) in one tx`,
      );
    });
  }
}
