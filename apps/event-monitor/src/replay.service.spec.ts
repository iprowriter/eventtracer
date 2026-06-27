import type { Admin, Kafka } from 'kafkajs';
import { type EventEnvelope, Topics } from '@app/events';
import type { EventMonitorGateway } from './event-monitor.gateway';
import { ReplayService } from './replay.service';

const envelope: EventEnvelope = {
  eventId: 'e1',
  eventType: Topics.OrderCreated,
  occurredAt: '2026-06-27T00:00:00.000Z',
  correlationId: 'order-1',
  version: 1,
  payload: { orderId: 'order-1' },
};

function record(partition: number, offset: number) {
  return {
    partition,
    message: {
      offset: String(offset),
      value: Buffer.from(JSON.stringify(envelope)),
    },
  };
}

// Wires a ReplayService up to mocked kafkajs internals. `records` are fed to the
// consumer's eachMessage in order; `offsets` is what admin.fetchTopicOffsets
// reports (the high-water mark replay stops at).
function setup(
  records: ReturnType<typeof record>[],
  offsets: { partition: number; low: string; high: string }[],
) {
  const broadcastReplay = jest.fn();
  const gateway = { broadcastReplay } as unknown as EventMonitorGateway;

  const disconnect = jest.fn();
  const consumer = {
    connect: jest.fn(),
    subscribe: jest.fn(),
    disconnect,
    run: jest.fn(
      async ({
        eachMessage,
      }: {
        eachMessage: (r: ReturnType<typeof record>) => Promise<void>;
      }) => {
        for (const r of records) await eachMessage(r);
      },
    ),
  };

  const admin = {
    fetchTopicOffsets: jest.fn().mockResolvedValue(offsets),
  } as unknown as Admin;
  const kafka = {
    consumer: jest.fn().mockReturnValue(consumer),
  } as unknown as Kafka;

  const service = new ReplayService(gateway);
  (service as unknown as { admin: Admin }).admin = admin;
  (service as unknown as { kafka: Kafka }).kafka = kafka;

  return { service, broadcastReplay, disconnect, consumer };
}

describe('ReplayService', () => {
  it('re-pushes every historical event then stops at the high-water mark', async () => {
    const { service, broadcastReplay, disconnect } = setup(
      [record(0, 0), record(0, 1)],
      [{ partition: 0, low: '0', high: '2' }],
    );

    const results = await service.replay(Topics.OrderCreated);

    expect(broadcastReplay).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1); // temp consumer cleaned up
    expect(results).toEqual([{ topic: Topics.OrderCreated, count: 2 }]);
  });

  it('sends nothing and never opens a consumer when the topic is empty', async () => {
    const { service, broadcastReplay, disconnect, consumer } = setup(
      [],
      [{ partition: 0, low: '0', high: '0' }],
    );

    const results = await service.replay(Topics.OrderCreated);

    expect(results).toEqual([{ topic: Topics.OrderCreated, count: 0 }]);
    expect(broadcastReplay).not.toHaveBeenCalled();
    expect(consumer.connect).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('rejects a second replay while one is already running', async () => {
    const { service } = setup(
      [record(0, 0)],
      [{ partition: 0, low: '0', high: '1' }],
    );

    const first = service.replay(Topics.OrderCreated);
    await expect(service.replay(Topics.OrderCreated)).rejects.toThrow(
      /already in progress/,
    );
    await first;
  });

  it('only treats known domain topics as replayable', () => {
    const { service } = setup([], []);
    expect(service.isKnownTopic(Topics.PaymentSucceeded)).toBe(true);
    expect(service.isKnownTopic('order.created.DLQ')).toBe(false);
    expect(service.isKnownTopic('nonsense')).toBe(false);
  });
});
