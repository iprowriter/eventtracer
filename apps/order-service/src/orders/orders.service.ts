import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderCommand } from '@app/events';
import { Order } from './order.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  async createOrder(command: CreateOrderCommand): Promise<void> {
    // Idempotency (ADR-006, rule #5): at-least-once delivery means this command
    // can arrive more than once. orderId is the PK, so a redelivery is a no-op.
    const existing = await this.orders.findOne({
      where: { id: command.orderId },
    });
    if (existing) {
      this.logger.warn(
        `Order ${command.orderId} already exists — skipping (duplicate delivery)`,
      );
      return;
    }

    const order = this.orders.create({
      id: command.orderId,
      items: command.items,
      amount: command.amount,
      status: 'CREATED',
    });
    await this.orders.save(order);
    this.logger.log(`Persisted order ${command.orderId} (status=CREATED)`);
  }
}
