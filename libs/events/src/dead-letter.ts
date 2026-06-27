import type { EventEnvelope } from './envelope';
import type { Topic } from './topics';

/**
 * What a consumer writes to `<topic>.DLQ` when it gives up on a message after N
 * retries (ADR-007). It carries the ORIGINAL envelope untouched plus failure
 * metadata, so a dead letter is fully inspectable in the UI. This is a shared
 * contract between every producing consumer and the Event Monitor, so it lives
 * here, not inside a service (rule #7).
 */
export interface DeadLetter {
  /** The topic the message arrived on; its dead-letter topic is `dlq(originalTopic)`. */
  originalTopic: Topic;
  /** ISO-8601 timestamp of when the consumer gave up. */
  failedAt: string;
  /** How many attempts were made before routing here. */
  attempts: number;
  /** The final error message that caused the give-up. */
  error: string;
  /** The full original event, exactly as received. */
  original: EventEnvelope;
}
