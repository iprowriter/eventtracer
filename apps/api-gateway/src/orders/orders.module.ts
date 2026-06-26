import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    // Registers an injectable Kafka *client* (producer) under the token
    // 'ORDER_SERVICE'. This is the gateway's outbound side — it PRODUCES
    // commands; the order-service app is the one that CONSUMES them.
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'api-gateway',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
          consumer: {
            // Only used if the gateway ever did request/reply. We emit()
            // (fire-and-forget), so this group stays effectively idle.
            groupId: 'api-gateway-orders',
          },
        },
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
