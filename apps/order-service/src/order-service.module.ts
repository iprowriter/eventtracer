import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderServiceController } from './order-service.controller';
import { Order } from './orders/order.entity';
import { OrdersService } from './orders/orders.service';
import { SnakeNamingStrategy } from './snake-naming.strategy';
import { OutboxMessage } from '@app/outbox';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'eventtracer',
      password: process.env.POSTGRES_PASSWORD ?? 'eventtracer',
      database: process.env.POSTGRES_DB ?? 'eventtracer',
      schema: 'order_service', // ADR-008: this service owns ONLY this schema
      namingStrategy: new SnakeNamingStrategy(), // camelCase props → snake_case columns
      entities: [Order, OutboxMessage],
      synchronize: true, // DEV ONLY: auto-creates tables from entities
    }),
    TypeOrmModule.forFeature([Order, OutboxMessage]), // exposes Repository<Order> for injection
  ],
  controllers: [OrderServiceController],
  providers: [OrdersService],
})
export class OrderServiceModule {}
