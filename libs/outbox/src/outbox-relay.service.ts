import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { IsNull, Repository } from 'typeorm';
import { OUTBOX_PRODUCER } from './outbox.constants';
import { OutboxMessage } from './outbox-message.entity';

/**
 * Polls THIS service's outbox and publishes unpublished rows to Kafka, then
 * marks them. Each service runs its own instance. At-least-once: a crash
 * between produce and mark re-publishes next tick — consumers must be idempotent.
 */
@Injectable()
export class OutboxRelay implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelay.name);
  private draining = false; // guard: never overlap two drains

  constructor(
    @InjectRepository(OutboxMessage)
    private readonly outbox: Repository<OutboxMessage>,
    @Inject(OUTBOX_PRODUCER) private readonly producer: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
  }

  // Demo cadence: poll every second. (Production levers we discussed —
  // batching, FOR UPDATE SKIP LOCKED for multiple relays, partial index,
  // CDC — slot in right here.)
  @Interval(1000)
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const pending = await this.outbox.find({
        where: { publishedAt: IsNull() }, // hits the partial index
        order: { createdAt: 'ASC' }, // oldest first
        take: 50, // batch cap
      });

      for (const row of pending) {
        // Produce, awaiting so we only mark published AFTER Kafka accepts it.
        // { key, value } lets Nest set the Kafka message KEY = row.key.
        await firstValueFrom(
          this.producer.emit(row.topic, { key: row.key, value: row.payload }),
        );
        row.publishedAt = new Date();
        await this.outbox.save(row);
        this.logger.log(
          `Published ${row.topic} (key=${row.key}) — outbox row ${row.id}`,
        );
      }
    } catch (err) {
      // Leave rows unpublished; next tick retries (at-least-once).
      this.logger.error('Outbox drain failed', err as Error);
    } finally {
      this.draining = false;
    }
  }
}
