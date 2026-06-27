import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type NotificationChannel = 'EMAIL' | 'SMS';

@Entity({ name: 'notifications' })
export class Notification {
  // PK = the eventId. Unlike the other services we DON'T key on orderId here:
  // notification reacts to MANY events per order (created, paid, shipped…), so
  // one row per order would be wrong. Each event has a unique eventId, and a
  // redelivered event carries the SAME eventId → it collides on this PK → the
  // "send" is a no-op (ADR-006). The eventId IS the idempotency key.
  @PrimaryColumn('uuid')
  eventId!: string;

  // Our own id for this notification, minted here; travels in notification.sent.
  @Column('uuid')
  notificationId!: string;

  // The saga/correlation id, kept for querying a single order's notifications.
  @Column('uuid')
  orderId!: string;

  // Which event triggered this notification (e.g. 'shipment.created').
  @Column({ type: 'varchar' })
  eventType!: string;

  @Column({ type: 'varchar' })
  channel!: NotificationChannel;

  // The simulated message body that would have been emailed/texted.
  @Column({ type: 'varchar' })
  message!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
