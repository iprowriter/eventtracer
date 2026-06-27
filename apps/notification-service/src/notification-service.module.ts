import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OUTBOX_PRODUCER, OutboxMessage, OutboxRelay } from '@app/outbox';
import { SnakeNamingStrategy } from '@app/persistence';
import { NotificationServiceController } from './notification-service.controller';
import { Notification } from './notifications/notification.entity';
import { NotificationsService } from './notifications/notifications.service';

@Module({
  imports: [
    // notification-service now PUBLISHES notification.sent, so it carries the
    // full producer machinery again: the relay timer (ScheduleModule), its own
    // outbox table (OutboxMessage), and an outbound producer (OUTBOX_PRODUCER).
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'eventtracer',
      password: process.env.POSTGRES_PASSWORD ?? 'eventtracer',
      database: process.env.POSTGRES_DB ?? 'eventtracer',
      schema: 'notification_service', // ADR-008: owns ONLY this schema
      namingStrategy: new SnakeNamingStrategy(),
      entities: [Notification, OutboxMessage],
      synchronize: true, // DEV ONLY
    }),
    TypeOrmModule.forFeature([Notification, OutboxMessage]),
    ClientsModule.register([
      {
        name: OUTBOX_PRODUCER,
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'notification-service-producer',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
        },
      },
    ]),
  ],
  controllers: [NotificationServiceController],
  providers: [NotificationsService, OutboxRelay],
})
export class NotificationServiceModule {}
