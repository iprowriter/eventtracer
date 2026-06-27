import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RefundServiceModule } from './refund-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    RefundServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'refund-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          // Its OWN group → actual group 'refund-service-server'.
          groupId: 'refund-service',
        },
      },
    },
  );
  await app.listen();
}
void bootstrap();
