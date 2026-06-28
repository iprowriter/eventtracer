import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ConsumerControlCommand, ControlTopic } from '@app/events';

/** DI token for the gateway's control-topic producer. */
export const CONTROL_PRODUCER = 'CONTROL_PRODUCER';

/**
 * Publishes consumer pause/resume commands for the kill-a-consumer demo
 * (ADR-014). The gateway is the browser's only way to reach Kafka (rule #1);
 * this is an operational control message, not a saga event.
 */
@Injectable()
export class ControlService implements OnModuleInit {
  private readonly logger = new Logger(ControlService.name);

  constructor(@Inject(CONTROL_PRODUCER) private readonly client: ClientKafka) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async setConsumer(cmd: ConsumerControlCommand): Promise<void> {
    await firstValueFrom(this.client.emit(ControlTopic, cmd));
    this.logger.log(`Published control ${cmd.action} for ${cmd.service}`);
  }
}
