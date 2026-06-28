import { Injectable, Logger } from '@nestjs/common';
import type { INestMicroservice } from '@nestjs/common';
import type { Consumer } from 'kafkajs';
import type { ConsumerControlAction } from '@app/events';

/**
 * Pauses/resumes a service's Kafka consumer on its DOMAIN topic — the engine
 * behind the "kill a consumer" demo (ADR-014). Pausing stops fetching that
 * topic, so its events buffer in the partition (consumer lag climbs); resuming
 * drains them. The consumer stays in its group the whole time, so the control
 * topic keeps flowing and resume always lands.
 *
 * A provider so the control @EventPattern handler can inject it; the actual
 * kafkajs Consumer is wired in once at startup via {@link bindConsumerControl}.
 */
@Injectable()
export class ConsumerControl {
  private readonly logger = new Logger(ConsumerControl.name);
  private consumer?: Consumer;
  private topic?: string;
  private paused = false;

  /** Called once from main.ts after the microservice is listening. */
  bind(consumer: Consumer, topic: string): void {
    this.consumer = consumer;
    this.topic = topic;
  }

  apply(action: ConsumerControlAction): void {
    if (action === 'pause') this.pause();
    else this.resume();
  }

  private pause(): void {
    if (!this.consumer || !this.topic || this.paused) return;
    this.consumer.pause([{ topic: this.topic }]);
    this.paused = true;
    this.logger.warn(`Consumer PAUSED on ${this.topic} (kill-a-consumer demo)`);
  }

  private resume(): void {
    if (!this.consumer || !this.topic || !this.paused) return;
    this.consumer.resume([{ topic: this.topic }]);
    this.paused = false;
    this.logger.log(`Consumer RESUMED on ${this.topic} — draining backlog`);
  }
}

/**
 * Reach into the running Nest microservice for its underlying kafkajs Consumer
 * and hand it to the {@link ConsumerControl} provider. The consumer only exists
 * after `app.listen()`, so call this AFTER listening.
 */
export function bindConsumerControl(
  app: INestMicroservice,
  topic: string,
): void {
  const logger = new Logger('bindConsumerControl');
  // For the Kafka transport, app.unwrap() delegates to ServerKafka.unwrap(),
  // which returns the tuple [client, consumer, producer]. Grab the consumer.
  const [, consumer] = app.unwrap<[unknown, Consumer | null, unknown]>();
  if (!consumer) {
    logger.warn('No kafka consumer to bind — kill-a-consumer disabled');
    return;
  }
  app.get(ConsumerControl).bind(consumer, topic);
  logger.log(`Consumer control bound on ${topic}`);
}
