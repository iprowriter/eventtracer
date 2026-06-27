import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { CreateOrderCommand, Topics } from '@app/events';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';
import { OutboxMessage } from '@app/outbox';

/**
 * Idempotency (ADR-006, rule #5): at-least-once delivery means the SAME command
 * can arrive twice. The second time must be a no-op.
 *
 * This is a unit test: we mock the transaction manager and assert the service's
 * dedup GUARD short-circuits. (The DB PK is the concurrency backstop — that'd
 * need an integration test against real Postgres.)
 */
describe('OrdersService — duplicate delivery', () => {
  let service: OrdersService;
  let orders: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock<Promise<Order>, [Order]>;
  };
  let outbox: {
    create: jest.Mock;
    save: jest.Mock<Promise<OutboxMessage>, [OutboxMessage]>;
  };

  const command: CreateOrderCommand = {
    orderId: 'order-1',
    items: [{ sku: 'BOOK-1', quantity: 2 }],
    amount: 42.5,
  };

  beforeEach(async () => {
    orders = {
      findOne: jest.fn(),
      create: jest.fn((x: Order) => x),
      save: jest.fn<Promise<Order>, [Order]>(),
    };
    outbox = {
      create: jest.fn((x: OutboxMessage) => x),
      save: jest.fn<Promise<OutboxMessage>, [OutboxMessage]>(),
    };

    // Fake manager: hands back our mock repos based on the entity requested.
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Order ? orders : outbox,
      ),
    } as unknown as EntityManager;

    // dataSource.transaction(cb) just runs cb with the fake manager.
    const dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) =>
        cb(manager),
      ),
    } as unknown as DataSource;

    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, { provide: DataSource, useValue: dataSource }],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  it('writes the order + an order.created outbox row for a new command', async () => {
    orders.findOne.mockResolvedValue(null); // never seen before

    await service.createOrder(command);

    expect(orders.save).toHaveBeenCalledTimes(1);
    expect(outbox.save).toHaveBeenCalledTimes(1);

    // the outbox row carries the right event for this saga
    const savedOutbox = outbox.save.mock.calls[0][0];
    expect(savedOutbox.topic).toBe(Topics.OrderCreated);
    expect(savedOutbox.key).toBe(command.orderId);
    expect(savedOutbox.payload.correlationId).toBe(command.orderId);
  });

  it('is a no-op on redelivery (order already exists)', async () => {
    orders.findOne.mockResolvedValue({ id: command.orderId }); // already processed

    await service.createOrder(command);

    expect(orders.save).not.toHaveBeenCalled();
    expect(outbox.save).not.toHaveBeenCalled();
  });
});
