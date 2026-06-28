import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Topics } from '@app/events';
import { bindConsumerControl } from '@app/kafka';
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
  // After listen() the kafkajs consumer exists — wire it to the control plane so
  // the UI can pause/resume consumption of order.created (ADR-014).
  bindConsumerControl(app, Topics.OrderCreated);
}
void bootstrap();
