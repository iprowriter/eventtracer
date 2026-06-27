import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'notification-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          // Its OWN group → actual group 'notification-service-server'.
          groupId: 'notification-service',
        },
      },
    },
  );
  await app.listen();
}
void bootstrap();
