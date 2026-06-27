import type { ClientKafka } from '@nestjs/microservices';
import { of } from 'rxjs';
import { type DeadLetter, type EventEnvelope, Topics, dlq } from '@app/events';
import { processWithDlq } from './dlq';

const envelope: EventEnvelope = {
  eventId: 'e1',
  eventType: Topics.OrderCreated,
  occurredAt: '2026-06-27T00:00:00.000Z',
  correlationId: 'order-1',
  version: 1,
  payload: { orderId: 'order-1' },
};

// Returns the standalone emit mock alongside the producer so tests reference the
// mock directly (avoids the unbound-method lint rule on producer.emit).
function mockProducer() {
  const emit = jest.fn().mockReturnValue(of(undefined));
  return { producer: { emit } as unknown as ClientKafka, emit };
}

type DlqMessage = { key: string; value: DeadLetter };

describe('processWithDlq', () => {
  it('runs the handler once on success and never dead-letters', async () => {
    const { producer, emit } = mockProducer();
    const handler = jest.fn().mockResolvedValue(undefined);

    await processWithDlq(
      envelope,
      { topic: Topics.OrderCreated, producer },
      handler,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalled();
  });

  it('retries N times then routes the original message to the DLQ', async () => {
    const { producer, emit } = mockProducer();
    const handler = jest.fn().mockRejectedValue(new Error('boom'));

    await processWithDlq(
      envelope,
      { topic: Topics.OrderCreated, producer, retries: 3 },
      handler,
    );

    expect(handler).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenCalledTimes(1);

    const [topicArg, message] = emit.mock.calls[0] as [string, DlqMessage];
    expect(topicArg).toBe(dlq(Topics.OrderCreated));
    expect(message.key).toBe('order-1'); // keyed by correlationId
    expect(message.value.error).toBe('boom');
    expect(message.value.attempts).toBe(3);
    expect(message.value.originalTopic).toBe(Topics.OrderCreated);
    expect(message.value.original).toBe(envelope);
  });

  it('recovers if a retry eventually succeeds (no dead-letter)', async () => {
    const { producer, emit } = mockProducer();
    const handler = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined);

    await processWithDlq(
      envelope,
      { topic: Topics.OrderCreated, producer, retries: 3 },
      handler,
    );

    expect(handler).toHaveBeenCalledTimes(2);
    expect(emit).not.toHaveBeenCalled();
  });
});
