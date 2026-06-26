import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { OrderServiceModule } from './order-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OrderServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'order-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          // This app's consumer group. Each service gets its OWN group so each
          // independently receives every message (the kill-a-consumer / replay
          // demos in Phase 3 depend on this).
          groupId: 'order-service',
        },
      },
    },
  );
  await app.listen();
}
void bootstrap();
