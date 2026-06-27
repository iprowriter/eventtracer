import { type EventEnvelope } from '@app/events';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A pending event, stored as a row so it can be written in the SAME transaction
 * as the business data (ADR-004). The relay drains rows where published_at IS
 * NULL → Kafka, then marks them. Generic: any service, any topic.
 */
@Entity({ name: 'outbox' })
// THE partial index from our scaling chat: it indexes ONLY unpublished rows, so
// the relay's `WHERE published_at IS NULL` scan tracks the backlog size, not the
// (potentially huge) total table size.
@Index('idx_outbox_unpublished', ['createdAt'], {
  where: '"published_at" IS NULL',
})
export class OutboxMessage {
  /** Surrogate id for this OUTBOX ROW (not the event's eventId — that's inside payload). */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Kafka topic to publish to, e.g. 'order.created'. */
  @Column()
  topic!: string;

  /** Kafka message key = correlationId/orderId, so a saga's events stay on one partition. */
  @Column()
  key!: string;

  /** The full event envelope, verbatim — exactly what the relay produces to Kafka. */
  @Column('jsonb')
  payload!: EventEnvelope;

  @CreateDateColumn()
  createdAt!: Date;

  /** NULL until the relay successfully publishes this row. */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
}
