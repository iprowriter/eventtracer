import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsumerControl } from '@app/kafka';
import { OUTBOX_PRODUCER, OutboxMessage, OutboxRelay } from '@app/outbox';
import { SnakeNamingStrategy } from '@app/persistence';
import { PaymentServiceController } from './payment-service.controller';
import { Payment } from './payments/payment.entity';
import { PaymentsService } from './payments/payments.service';

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
      schema: 'payment_service', // ADR-008: this service owns ONLY this schema
      namingStrategy: new SnakeNamingStrategy(),
      entities: [Payment, OutboxMessage],
      synchronize: true, // DEV ONLY
    }),
    TypeOrmModule.forFeature([Payment, OutboxMessage]),
    // The OUTBOUND Kafka producer the relay publishes through (separate from the
    // inbound microservice server in main.ts), injected via the OUTBOX_PRODUCER token.
    ClientsModule.register([
      {
        name: OUTBOX_PRODUCER,
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'payment-service-producer',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
        },
      },
    ]),
  ],
  controllers: [PaymentServiceController],
  // ConsumerControl powers the kill-a-consumer demo (ADR-014); main.ts binds it
  // to the live kafkajs consumer after listen().
  providers: [PaymentsService, OutboxRelay, ConsumerControl],
})
export class PaymentServiceModule {}
