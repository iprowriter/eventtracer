import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OUTBOX_PRODUCER, OutboxMessage, OutboxRelay } from '@app/outbox';
import { SnakeNamingStrategy } from './snake-naming.strategy';
import { OrderServiceController } from './order-service.controller';
import { Order } from './orders/order.entity';
import { OrdersService } from './orders/orders.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // enables @Interval in the relay
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'eventtracer',
      password: process.env.POSTGRES_PASSWORD ?? 'eventtracer',
      database: process.env.POSTGRES_DB ?? 'eventtracer',
      schema: 'order_service', // ADR-008: this service owns ONLY this schema
      namingStrategy: new SnakeNamingStrategy(),
      entities: [Order, OutboxMessage],
      synchronize: true, // DEV ONLY
    }),
    TypeOrmModule.forFeature([Order, OutboxMessage]),
    // The OUTBOUND Kafka producer the relay publishes through. Registered under
    // the OUTBOX_PRODUCER token so OutboxRelay (in libs/outbox) can inject it.
    // This is separate from the inbound microservice server in main.ts.
    ClientsModule.register([
      {
        name: OUTBOX_PRODUCER,
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'order-service-producer',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
        },
      },
    ]),
  ],
  controllers: [OrderServiceController],
  providers: [OrdersService, OutboxRelay],
})
export class OrderServiceModule {}
