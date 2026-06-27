import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ShippingServiceModule } from './shipping-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ShippingServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'shipping-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          // Its OWN group → actual group 'shipping-service-server'.
          groupId: 'shipping-service',
        },
      },
    },
  );
  await app.listen();
}
void bootstrap();
