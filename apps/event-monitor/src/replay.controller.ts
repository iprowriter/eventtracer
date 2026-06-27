import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ReplayResult, ReplayService } from './replay.service';

/**
 * The replay endpoint (specs §4.7 / §6 "Replay events"). The browser POSTs here
 * exactly the way scenario buttons POST intents to the gateway — it never
 * publishes to Kafka itself (rule #1). Replay is an OBSERVABILITY action: the
 * monitor only consumes, never produces, and uses a throwaway group, so no
 * domain service is re-triggered (ADR-002).
 */
@Controller('replay')
export class ReplayController {
  private readonly logger = new Logger(ReplayController.name);

  constructor(private readonly replay: ReplayService) {}

  @Post()
  async replayTopic(
    @Query('topic') topic?: string,
  ): Promise<{ replayed: ReplayResult[] }> {
    if (topic === undefined) {
      this.logger.log('replay requested: ALL topics');
      return { replayed: await this.replay.replay() };
    }
    if (!this.replay.isKnownTopic(topic)) {
      throw new BadRequestException(`unknown topic: ${topic}`);
    }
    // The guard above narrowed `topic` to a known Topic here.
    this.logger.log(`replay requested: ${topic}`);
    return { replayed: await this.replay.replay(topic) };
  }
}
