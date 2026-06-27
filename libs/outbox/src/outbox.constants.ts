/**
 * DI token for the Kafka producer the relay publishes through. The relay lives
 * in this lib and can't know what name a given service registered its client
 * under — so the service registers its ClientKafka under THIS token, and the
 * relay injects it by the same token.
 */
export const OUTBOX_PRODUCER = 'OUTBOX_PRODUCER';
