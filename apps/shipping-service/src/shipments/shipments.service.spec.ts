import { DataSource } from 'typeorm';
import { PaymentSucceededPayload, Topics } from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Shipment } from './shipment.entity';
import { ShipmentsService } from './shipments.service';
import { chooseCarrier } from './shipment.simulator';

// A fake EntityManager whose findOne result we control per test, recording the
// rows save() is asked to persist so we can assert what got written.
function makeManager(existingShipment: Shipment | null) {
  const saved: { shipments: unknown[]; outbox: unknown[] } = {
    shipments: [],
    outbox: [],
  };
  const repos = {
    [Shipment.name]: {
      findOne: jest.fn().mockResolvedValue(existingShipment),
      create: (x: unknown) => x,
      save: jest.fn((x: unknown) => {
        saved.shipments.push(x);
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
  return { manager, saved, repos };
}

function makeService(existingShipment: Shipment | null) {
  const { manager, saved, repos } = makeManager(existingShipment);
  const dataSource = {
    transaction: (cb: (m: unknown) => unknown) => cb(manager),
  } as unknown as DataSource;
  return { service: new ShipmentsService(dataSource), saved, repos };
}

const payment: PaymentSucceededPayload = {
  orderId: '11111111-1111-1111-1111-111111111111',
  paymentId: '22222222-2222-2222-2222-222222222222',
  amount: 42,
};

describe('ShipmentsService', () => {
  it('creates a shipment + one outbox event on first delivery', async () => {
    const { service, saved } = makeService(null);
    await service.handlePaymentSucceeded(payment);

    expect(saved.shipments).toHaveLength(1);
    expect(saved.outbox).toHaveLength(1);

    const event = saved.outbox[0] as {
      topic: string;
      payload: { payload: { carrier: string } };
    };
    expect(event.topic).toBe(Topics.ShipmentCreated);
    // carrier is the deterministic choice for this orderId
    expect(event.payload.payload.carrier).toBe(chooseCarrier(payment.orderId));
  });

  it('is a no-op on duplicate delivery (idempotent)', async () => {
    const existing = { orderId: payment.orderId } as Shipment;
    const { service, saved } = makeService(existing);
    await service.handlePaymentSucceeded(payment);

    expect(saved.shipments).toHaveLength(0);
    expect(saved.outbox).toHaveLength(0);
  });

  it('chooseCarrier is deterministic', () => {
    expect(chooseCarrier(payment.orderId)).toBe(chooseCarrier(payment.orderId));
  });
});
