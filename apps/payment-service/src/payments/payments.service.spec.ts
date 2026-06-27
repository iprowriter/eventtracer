import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { OrderCreatedPayload, Topics } from '@app/events';
import { OutboxMessage } from '@app/outbox';
import { Payment } from './payment.entity';
import { PaymentsService } from './payments.service';
import { decidePaymentOutcome } from './payment.simulator';

/**
 * Idempotency (ADR-006, rule #5): at-least-once delivery means the SAME
 * order.created can arrive twice. The second time must be a no-op.
 *
 * Unit test: we mock the transaction manager and assert the service's dedup
 * GUARD short-circuits. (The DB PK is the concurrency backstop.)
 */
describe('PaymentsService — duplicate delivery', () => {
  let service: PaymentsService;
  let payments: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock<Promise<Payment>, [Payment]>;
  };
  let outbox: {
    create: jest.Mock;
    save: jest.Mock<Promise<OutboxMessage>, [OutboxMessage]>;
  };

  const order: OrderCreatedPayload = {
    orderId: 'order-1',
    items: [{ sku: 'BOOK-1', quantity: 2 }],
    amount: 42.5,
  };

  beforeEach(async () => {
    payments = {
      findOne: jest.fn(),
      create: jest.fn((x: Payment) => x),
      save: jest.fn<Promise<Payment>, [Payment]>(),
    };
    outbox = {
      create: jest.fn((x: OutboxMessage) => x),
      save: jest.fn<Promise<OutboxMessage>, [OutboxMessage]>(),
    };

    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Payment ? payments : outbox,
      ),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) =>
        cb(manager),
      ),
    } as unknown as DataSource;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
  });

  it('writes a payment row + a payment.* outbox row matching the simulated outcome', async () => {
    payments.findOne.mockResolvedValue(null); // never seen before

    await service.handleOrderCreated(order);

    expect(payments.save).toHaveBeenCalledTimes(1);
    expect(outbox.save).toHaveBeenCalledTimes(1);

    // The published topic is the deterministic decision for THIS orderId.
    const expectedTopic =
      decidePaymentOutcome(order.orderId) === 'SUCCEEDED'
        ? Topics.PaymentSucceeded
        : Topics.PaymentFailed;
    const savedOutbox = outbox.save.mock.calls[0][0];
    expect(savedOutbox.topic).toBe(expectedTopic);
    expect(savedOutbox.key).toBe(order.orderId);
    expect(savedOutbox.payload.correlationId).toBe(order.orderId);
  });

  it('is a no-op on redelivery (payment already processed)', async () => {
    payments.findOne.mockResolvedValue({ orderId: order.orderId });

    await service.handleOrderCreated(order);

    expect(payments.save).not.toHaveBeenCalled();
    expect(outbox.save).not.toHaveBeenCalled();
  });
});

/** Determinism (specs.md): the same orderId always resolves the same way. */
describe('decidePaymentOutcome', () => {
  it('is a pure function of the orderId', () => {
    expect(decidePaymentOutcome('order-1')).toBe(
      decidePaymentOutcome('order-1'),
    );
  });
});
