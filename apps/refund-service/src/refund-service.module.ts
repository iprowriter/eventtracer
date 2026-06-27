import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OUTBOX_PRODUCER, OutboxMessage, OutboxRelay } from '@app/outbox';
import { SnakeNamingStrategy } from '@app/persistence';
import { RefundServiceController } from './refund-service.controller';
import { Refund } from './refunds/refund.entity';
import { RefundsService } from './refunds/refunds.service';

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
      schema: 'refund_service', // ADR-008: this service owns ONLY this schema
      namingStrategy: new SnakeNamingStrategy(),
      entities: [Refund, OutboxMessage],
      synchronize: true, // DEV ONLY
    }),
    TypeOrmModule.forFeature([Refund, OutboxMessage]),
    ClientsModule.register([
      {
        name: OUTBOX_PRODUCER,
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'refund-service-producer',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
        },
      },
    ]),
  ],
  controllers: [RefundServiceController],
  providers: [RefundsService, OutboxRelay],
})
export class RefundServiceModule {}
