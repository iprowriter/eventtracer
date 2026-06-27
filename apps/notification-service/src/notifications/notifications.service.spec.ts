import { DataSource } from 'typeorm';
import { EventEnvelope, ShipmentCreatedPayload, Topics } from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';

// Fake EntityManager: findOne result is controllable, saves are recorded so we
// can assert both the notification row and the outbox(notification.sent) row.
function makeManager(existing: Notification | null) {
  const saved: { notifications: unknown[]; outbox: unknown[] } = {
    notifications: [],
    outbox: [],
  };
  const repos = {
    [Notification.name]: {
      findOne: jest.fn().mockResolvedValue(existing),
      create: (x: unknown) => x,
      save: jest.fn((x: unknown) => {
        saved.notifications.push(x);
        return Promise.resolve(x);
      }),
    },
    [OutboxMessage.name]: {
      create: (x: unknown) => x,
      save: jest.fn((x: unknown) => {
        saved.outbox.push(x);
        return Promise.resolve(x);
      }),
    },
  };
  const manager = {
    getRepository: (entity: { name: string }) => repos[entity.name],
  };
  return { manager, saved };
}

function makeService(existing: Notification | null) {
  const { manager, saved } = makeManager(existing);
  const dataSource = {
    transaction: (cb: (m: unknown) => unknown) => cb(manager),
  } as unknown as DataSource;
  return { service: new NotificationsService(dataSource), saved };
}

const shipmentEvent: EventEnvelope<ShipmentCreatedPayload> = {
  eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  eventType: Topics.ShipmentCreated,
  occurredAt: '2026-06-27T00:00:00.000Z',
  correlationId: '11111111-1111-1111-1111-111111111111',
  version: 1,
  payload: {
    orderId: '11111111-1111-1111-1111-111111111111',
    shipmentId: '22222222-2222-2222-2222-222222222222',
    carrier: 'UPS',
  },
};

describe('NotificationsService', () => {
  it('records a notification + emits one notification.sent on first delivery', async () => {
    const { service, saved } = makeService(null);
    await service.notify(shipmentEvent);

    expect(saved.notifications).toHaveLength(1);
    expect(saved.outbox).toHaveLength(1);

    const row = saved.notifications[0] as Notification;
    expect(row.eventId).toBe(shipmentEvent.eventId); // dedupe key = consumed id
    expect(row.channel).toBe('SMS'); // shipment → SMS

    const out = saved.outbox[0] as {
      topic: string;
      payload: EventEnvelope<{ triggeredBy: string; channel: string }>;
    };
    expect(out.topic).toBe(Topics.NotificationSent);
    expect(out.payload.eventType).toBe(Topics.NotificationSent);
    expect(out.payload.correlationId).toBe(shipmentEvent.correlationId);
    expect(out.payload.payload.triggeredBy).toBe(Topics.ShipmentCreated);
    // emitted event id must NOT reuse the consumed event's id (no PK collision)
    expect(out.payload.eventId).not.toBe(shipmentEvent.eventId);
  });

  it('is a no-op on duplicate delivery (same consumed eventId)', async () => {
    const existing = { eventId: shipmentEvent.eventId } as Notification;
    const { service, saved } = makeService(existing);
    await service.notify(shipmentEvent);

    expect(saved.notifications).toHaveLength(0);
    expect(saved.outbox).toHaveLength(0);
  });

  it('renders an EMAIL for payment.failed including the reason', async () => {
    const { service, saved } = makeService(null);
    const failed: EventEnvelope = {
      ...shipmentEvent,
      eventId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      eventType: Topics.PaymentFailed,
      payload: {
        orderId: shipmentEvent.correlationId,
        amount: 42,
        reason: 'Card declined (simulated)',
      },
    };
    await service.notify(failed);

    const row = saved.notifications[0] as Notification;
    expect(row.channel).toBe('EMAIL');
    expect(row.message).toContain('Card declined');
  });
});
