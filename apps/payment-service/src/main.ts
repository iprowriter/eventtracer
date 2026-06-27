import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { PaymentServiceModule } from './payment-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PaymentServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'payment-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          // Its OWN group, distinct from order-service's, so it independently
          // receives every order.created (kill-a-consumer / replay demos rely
          // on this). Nest appends '-server' → actual group 'payment-service-server'.
          groupId: 'payment-service',
        },
      },
    },
  );
  await app.listen();
}
void bootstrap();
