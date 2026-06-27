import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Admin, Kafka } from 'kafkajs';
import { type EventEnvelope, type Topic, Topics } from '@app/events';
import { EventMonitorGateway } from './event-monitor.gateway';

/** How one topic's replay went — surfaced in the POST /replay response. */
export interface ReplayResult {
  topic: string;
  count: number;
}

/**
 * Re-reads a topic's log from offset 0 and re-pushes every historical event to
 * the UI — the "Replay events" scenario (specs §4.7 / §6). The point it makes:
 * the Kafka log is the source of truth and the UI is just a projection of it, so
 * the whole timeline can be rebuilt from the log alone.
 *
 * It does this with a THROWAWAY consumer group (a random id, fromBeginning) and
 * NEVER produces to Kafka, so domain services see nothing — replay only rebuilds
 * the browser timeline. Observability stays decoupled from the saga (ADR-002).
 */
@Injectable()
export class ReplayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReplayService.name);
  private kafka!: Kafka;
  private admin?: Admin;
  private replaying = false; // one replay at a time — don't fan out temp consumers

  constructor(private readonly gateway: EventMonitorGateway) {}

  /** Every domain topic, in saga order — the default "replay everything". */
  private readonly allTopics: readonly Topic[] = [
    Topics.OrderCreated,
    Topics.PaymentSucceeded,
    Topics.PaymentFailed,
    Topics.ShipmentCreated,
    Topics.RefundInitiated,
    Topics.NotificationSent,
  ];

  async onModuleInit() {
    this.kafka = new Kafka({
      clientId: 'event-monitor-replay',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    this.admin = this.kafka.admin();
    await this.admin.connect();
    this.logger.log('Kafka admin connected — replay ready');
  }

  async onModuleDestroy() {
    await this.admin?.disconnect();
  }

  /** True if `topic` is a known domain topic (so the controller can 400 early). */
  isKnownTopic(topic: string): topic is Topic {
    return (this.allTopics as readonly string[]).includes(topic);
  }

  /** Replay one topic, or all of them when `topic` is omitted. */
  async replay(topic?: Topic): Promise<ReplayResult[]> {
    if (this.replaying) {
      throw new Error('a replay is already in progress');
    }
    this.replaying = true;
    try {
      const topics = topic ? [topic] : this.allTopics;
      const results: ReplayResult[] = [];
      for (const t of topics) {
        results.push(await this.replayTopic(t));
      }
      return results;
    } finally {
      this.replaying = false;
    }
  }

  /**
   * Drain one topic from the start. We snapshot the high-water mark up front and
   * stop the moment every partition has reached it, so the temp consumer doesn't
   * sit tailing for new live messages after the historical log is exhausted.
   */
  private async replayTopic(topic: Topic): Promise<ReplayResult> {
    const admin = this.admin!;

    // Where does the log currently end? Replay must stop here, not tail forever.
    const targets = new Map<number, number>(); // partition -> high offset (exclusive)
    for (const p of await admin.fetchTopicOffsets(topic)) {
      const high = Number(p.high);
      const low = Number(p.low);
      if (high > low) targets.set(p.partition, high);
    }
    if (targets.size === 0) {
      this.logger.log(`replay ${topic}: empty, nothing to send`);
      return { topic, count: 0 };
    }

    const consumer = this.kafka.consumer({
      // Random group id => a fresh consumer that owns no committed offsets and
      // can't disturb the real groups. fromBeginning then reads the whole log.
      groupId: `event-monitor-replay-${randomUUID()}`,
    });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });

    let count = 0;
    await new Promise<void>((resolve) => {
      // Safety net: if the partition math is ever off, never hang forever.
      const timer = setTimeout(resolve, 15000);
      void consumer.run({
        // Synchronous work (parse + push), but kafkajs's handler type wants a
        // Promise<void>, so we return a resolved one rather than mark it async.
        eachMessage: ({ partition, message }) => {
          if (message.value) {
            try {
              const envelope = JSON.parse(
                message.value.toString(),
              ) as EventEnvelope;
              this.gateway.broadcastReplay(envelope);
              count++;
            } catch {
              // not an envelope (shouldn't happen on a domain topic) — skip it
            }
          }
          const end = targets.get(partition);
          if (end !== undefined && Number(message.offset) >= end - 1) {
            targets.delete(partition); // this partition has drained to the head
          }
          if (targets.size === 0) {
            clearTimeout(timer);
            resolve();
          }
          return Promise.resolve();
        },
      });
    });

    await consumer.disconnect();
    this.logger.log(`replay ${topic}: re-sent ${count} event(s)`);
    return { topic, count };
  }
}
