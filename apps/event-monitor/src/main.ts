import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { EventMonitorModule } from './event-monitor.module';

async function bootstrap() {
  // An HTTP app this time (not createMicroservice) — it hosts the WebSocket
  // server the browser connects to.
  const app = await NestFactory.create(EventMonitorModule);

  // Attach the Kafka consumer to the SAME process. Hybrid app: HTTP/WebSocket
  // out to the browser, Kafka in from the domain services.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'event-monitor',
        brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
      },
      consumer: {
        // Same own-group reasoning as before — parallel observer (ADR-002).
        groupId: 'event-monitor',
      },
    },
  });

  app.enableCors(); // dev: the 6.3 browser page loads from a different origin

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
