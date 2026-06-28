import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ControlController } from './control.controller';
import { CONTROL_PRODUCER, ControlService } from './control.service';

@Module({
  imports: [
    // The gateway's outbound producer for control-topic messages (separate
    // client from the orders command producer).
    ClientsModule.register([
      {
        name: CONTROL_PRODUCER,
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'api-gateway-control',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
        },
      },
    ]),
  ],
  controllers: [ControlController],
  providers: [ControlService],
})
export class ControlModule {}
