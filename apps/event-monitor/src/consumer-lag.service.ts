import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Admin, Kafka } from 'kafkajs';
import { Commands, Topics } from '@app/events';
import { EventMonitorGateway } from './event-monitor.gateway';

/** One row in the UI's service-health bar. */
export interface ConsumerStatus {
  service: string;
  /**
   * 'up' = the group has a live member; 'down' = killed/empty;
   * 'paused' = deliberately paused via the control plane (ADR-014). A paused
   * consumer is still a group member, so we track it separately and override.
   */
  status: 'up' | 'down' | 'paused';
  /** Total un-consumed messages across all of the group's partitions. */
  lag: number;
}

/**
 * The consumer groups we watch and the topics each one feeds on. The ACTUAL
 * Kafka group id is the service's configured groupId PLUS Nest's '-server'
 * suffix — Nest appends it to every microservice consumer group, so the group
 * the broker knows for e.g. payment-service is 'payment-service-server'.
 *
 * Topic names come from @app/events (rule #7) — never hardcoded here.
 */
const WATCHED = [
  {
    service: 'order-service',
    groupId: 'order-service-server',
    topics: [Commands.CreateOrder],
  },
  {
    service: 'payment-service',
    groupId: 'payment-service-server',
    topics: [Topics.OrderCreated],
  },
  {
    service: 'shipping-service',
    groupId: 'shipping-service-server',
    topics: [Topics.PaymentSucceeded],
  },
  {
    service: 'notification-service',
    groupId: 'notification-service-server',
    topics: [
      Topics.OrderCreated,
      Topics.PaymentSucceeded,
      Topics.PaymentFailed,
      Topics.ShipmentCreated,
      Topics.RefundInitiated,
    ],
  },
  {
    service: 'refund-service',
    groupId: 'refund-service-server',
    topics: [Topics.PaymentFailed],
  },
] as const;

/**
 * Surfaces per-service consumer health to the UI. This is the data behind the
 * "kill a consumer" demo: stop e.g. shipping-service and you'll watch its dot go
 * red while payment.succeeded lag climbs (events buffering in the partition);
 * restart it and the lag drains back to 0 — the clearest proof this is async
 * choreography, not a chain of REST calls.
 *
 * We use a read-only Kafka Admin client and NEVER consume the domain topics
 * here, so observability stays decoupled from the saga (ADR-002).
 */
@Injectable()
export class ConsumerLagService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerLagService.name);
  private admin?: Admin;
  private polling = false; // guards against overlapping polls if one runs slow
  /** Services the UI has paused via the control plane (ADR-014). */
  private readonly paused = new Set<string>();

  constructor(private readonly gateway: EventMonitorGateway) {}

  /**
   * Record a pause/resume so the next status poll reports the service as
   * 'paused' rather than 'up' (it's still a group member while paused). Fed by
   * the monitor's control-topic handler — observability stays decoupled (ADR-002).
   */
  setPaused(service: string, isPaused: boolean): void {
    if (isPaused) this.paused.add(service);
    else this.paused.delete(service);
  }

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'event-monitor-admin',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    this.admin = kafka.admin();
    await this.admin.connect();
    this.logger.log('Kafka admin connected — watching consumer health');
  }

  async onModuleDestroy() {
    await this.admin?.disconnect();
  }

  @Interval(2000)
  async poll() {
    if (!this.admin || this.polling) return;
    this.polling = true;
    try {
      const snapshot = await Promise.all(
        WATCHED.map((w) => this.inspect(w.service, w.groupId, [...w.topics])),
      );
      this.gateway.broadcastStatus(snapshot);
    } catch (err) {
      this.logger.warn(`lag poll failed: ${String(err)}`);
    } finally {
      this.polling = false;
    }
  }

  private async inspect(
    service: string,
    groupId: string,
    topics: string[],
  ): Promise<ConsumerStatus> {
    const admin = this.admin!;

    // UP/DOWN — a killed service leaves the group, which empties its members.
    let status: ConsumerStatus['status'] = 'down';
    try {
      const { groups } = await admin.describeGroups([groupId]);
      status = (groups[0]?.members?.length ?? 0) > 0 ? 'up' : 'down';
    } catch {
      status = 'down';
    }

    // A paused consumer is still a live member, so override 'up' → 'paused'
    // (ADR-014). If it's genuinely down, leave that — paused is moot.
    if (status === 'up' && this.paused.has(service)) status = 'paused';

    // LAG — high-water mark minus the group's committed offset, per partition.
    let lag = 0;
    try {
      const heads = new Map<string, number>(); // `${topic}:${partition}` -> high offset
      for (const topic of topics) {
        for (const p of await admin.fetchTopicOffsets(topic)) {
          heads.set(`${topic}:${p.partition}`, Number(p.high));
        }
      }
      const committed = await admin.fetchOffsets({ groupId, topics });
      for (const t of committed) {
        for (const p of t.partitions) {
          const head = heads.get(`${t.topic}:${p.partition}`) ?? 0;
          const offset = Number(p.offset); // '-1' = group never committed here yet
          if (offset >= 0) lag += Math.max(0, head - offset);
        }
      }
    } catch {
      // topic/group not created yet — treat as zero lag
    }

    return { service, status, lag };
  }
}
