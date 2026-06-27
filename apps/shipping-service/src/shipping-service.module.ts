import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OUTBOX_PRODUCER, OutboxMessage, OutboxRelay } from '@app/outbox';
import { SnakeNamingStrategy } from '@app/persistence';
import { ShippingServiceController } from './shipping-service.controller';
import { Shipment } from './shipments/shipment.entity';
import { ShipmentsService } from './shipments/shipments.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'eventtracer',
      password: process.env.POSTGRES_PASSWORD ?? 'eventtracer',
      database: process.env.POSTGRES_DB ?? 'eventtracer',
      schema: 'shipping_service', // ADR-008: this service owns ONLY this schema
      namingStrategy: new SnakeNamingStrategy(),
      entities: [Shipment, OutboxMessage],
      synchronize: true, // DEV ONLY
    }),
    TypeOrmModule.forFeature([Shipment, OutboxMessage]),
    ClientsModule.register([
      {
        name: OUTBOX_PRODUCER,
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'shipping-service-producer',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
        },
      },
    ]),
  ],
  controllers: [ShippingServiceController],
  providers: [ShipmentsService, OutboxRelay],
})
export class ShippingServiceModule {}
