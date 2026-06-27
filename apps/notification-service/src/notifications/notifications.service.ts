import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EventEnvelope, NotificationSentPayload, Topics } from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Notification } from './notification.entity';
import { renderNotification } from './notification.renderer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // notification-service became a producer too (it emits notification.sent so
  // the Event Monitor — and the browser — can see it). So we're back to the
  // outbox pattern: the notification row and the outbox row commit in ONE
  // transaction (ADR-004), and the relay publishes later.
  constructor(private readonly dataSource: DataSource) {}

  async notify(envelope: EventEnvelope): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const notifications = manager.getRepository(Notification);
      const outbox = manager.getRepository(OutboxMessage);

      // Idempotency (ADR-006): dedupe on the CONSUMED event's id. A redelivered
      // event carries the same eventId → no second notification, no second
      // outbox row. (The emitted notification.sent gets its own fresh id below,
      // so it never collides with this key.)
      const existing = await notifications.findOne({
        where: { eventId: envelope.eventId },
      });
      if (existing) {
        this.logger.warn(
          `Notification for event ${envelope.eventId} already sent — skipping (duplicate delivery)`,
        );
        return;
      }

      const { channel, message } = renderNotification(envelope);
      const notificationId = randomUUID();

      // (1) record the notification we "sent"
      await notifications.save(
        notifications.create({
          eventId: envelope.eventId, // dedupe key = the event we reacted to
          notificationId,
          orderId: envelope.correlationId,
          eventType: envelope.eventType,
          channel,
          message,
        }),
      );

      // (2) announce it on Kafka so the Event Monitor broadcasts it to the UI.
      const payload: NotificationSentPayload = {
        orderId: envelope.correlationId,
        notificationId,
        channel,
        message,
        triggeredBy: envelope.eventType,
      };
      const sent: EventEnvelope = {
        eventId: notificationId, // fresh id for THIS event
        eventType: Topics.NotificationSent,
        occurredAt: new Date().toISOString(),
        correlationId: envelope.correlationId, // same saga id → groups in the UI
        version: 1,
        payload,
      };
      await outbox.save(
        outbox.create({
          topic: Topics.NotificationSent,
          key: envelope.correlationId, // partition key — saga events stay ordered
          payload: sent,
        }),
      );

      this.logger.log(
        `[${channel}] (order ${envelope.correlationId}) ${message} → outbox(${Topics.NotificationSent})`,
      );
    });
  }
}
