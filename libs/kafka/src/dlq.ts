import { Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  type DeadLetter,
  type EventEnvelope,
  type Topic,
  dlq,
} from '@app/events';

export interface DlqOptions {
  /** The topic the message arrived on — names the DLQ via `dlq(topic)`. */
  topic: Topic;
  /**
   * Producer used to emit to the DLQ topic. Reuse the service's OUTBOX_PRODUCER
   * client — it's already connected.
   */
  producer: ClientKafka;
  /** Attempts before giving up. Default 3. */
  retries?: number;
  logger?: Logger;
}

/**
 * Run a consumer handler with bounded retry, then dead-letter on permanent
 * failure (ADR-007).
 *
 * - On success it returns normally, so Nest commits the offset.
 * - After `retries` failed attempts it routes the ORIGINAL envelope + failure
 *   metadata to `<topic>.DLQ` and returns — the offset still commits, so a
 *   poison message never blocks the partition forever.
 *
 * The DLQ produce is a DIRECT publish, NOT outbox-backed: there's no business
 * state to be atomic with (processing FAILED, nothing was written), and a lost
 * DLQ produce just means the message is redelivered and retried again — which is
 * acceptable. ADR-004's outbox rule governs DOMAIN event publishing, not
 * operational dead-lettering.
 */
export async function processWithDlq(
  envelope: EventEnvelope,
  options: DlqOptions,
  handler: () => Promise<void>,
): Promise<void> {
  const { topic, producer, logger } = options;
  const retries = options.retries ?? 3;

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await handler();
      return; // success → Nest commits the offset and we move on
    } catch (err) {
      lastError = err;
      logger?.warn(
        `[${topic}] attempt ${attempt}/${retries} failed for ${envelope.correlationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const deadLetter: DeadLetter = {
    originalTopic: topic,
    failedAt: new Date().toISOString(),
    attempts: retries,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    original: envelope,
  };

  // Await so we only return (and let the offset commit) once the broker has the
  // dead letter — otherwise a crash here could drop it.
  await firstValueFrom(
    producer.emit(dlq(topic), {
      key: envelope.correlationId,
      value: deadLetter,
    }),
  );
  logger?.error(
    `[${topic}] gave up after ${retries} attempts → routed ${envelope.correlationId} to ${dlq(topic)}`,
  );
}
