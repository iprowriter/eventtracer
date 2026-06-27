import { DataSource } from 'typeorm';
import { PaymentFailedPayload, Topics } from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Refund } from './refund.entity';
import { RefundsService } from './refunds.service';

// Fake EntityManager: findOne is controllable; saves are recorded so we can
// assert both the refund row and the outbox(refund.initiated) row.
function makeManager(existing: Refund | null) {
  const saved: { refunds: unknown[]; outbox: unknown[] } = {
    refunds: [],
    outbox: [],
  };
  const repos = {
    [Refund.name]: {
      findOne: jest.fn().mockResolvedValue(existing),
      create: (x: unknown) => x,
      save: jest.fn((x: unknown) => {
        saved.refunds.push(x);
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

function makeService(existing: Refund | null) {
  const { manager, saved } = makeManager(existing);
  const dataSource = {
    transaction: (cb: (m: unknown) => unknown) => cb(manager),
  } as unknown as DataSource;
  return { service: new RefundsService(dataSource), saved };
}

const payment: PaymentFailedPayload = {
  orderId: '11111111-1111-1111-1111-111111111111',
  amount: 42,
  reason: 'Card declined (simulated)',
};

describe('RefundsService', () => {
  it('initiates a refund + one outbox event on first delivery', async () => {
    const { service, saved } = makeService(null);
    await service.handlePaymentFailed(payment);

    expect(saved.refunds).toHaveLength(1);
    expect(saved.outbox).toHaveLength(1);

    const refund = saved.refunds[0] as Refund;
    expect(refund.orderId).toBe(payment.orderId);
    expect(refund.amount).toBe(payment.amount); // refunds the failed amount

    const out = saved.outbox[0] as {
      topic: string;
      payload: { eventType: string; payload: { amount: number } };
    };
    expect(out.topic).toBe(Topics.RefundInitiated);
    expect(out.payload.eventType).toBe(Topics.RefundInitiated);
    expect(out.payload.payload.amount).toBe(payment.amount);
  });

  it('is a no-op on duplicate delivery (idempotent)', async () => {
    const existing = { orderId: payment.orderId } as Refund;
    const { service, saved } = makeService(existing);
    await service.handlePaymentFailed(payment);

    expect(saved.refunds).toHaveLength(0);
    expect(saved.outbox).toHaveLength(0);
  });
});
