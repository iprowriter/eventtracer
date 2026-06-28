import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CONTROLLABLE_SERVICES, isControllableService } from '@app/events';
import { ControlService } from './control.service';

/**
 * Pause/resume a service's Kafka consumer from the UI (kill-a-consumer, ADR-014).
 * The browser POSTs here; the gateway forwards a control message over Kafka.
 */
@Controller('control')
export class ControlController {
  constructor(private readonly controlService: ControlService) {}

  @Post(':service/:action')
  @HttpCode(202)
  async control(
    @Param('service') service: string,
    @Param('action') action: string,
  ): Promise<{ service: string; action: string }> {
    if (!isControllableService(service)) {
      throw new BadRequestException(
        `Service '${service}' is not controllable. Allowed: ${CONTROLLABLE_SERVICES.join(', ')}`,
      );
    }
    if (action !== 'pause' && action !== 'resume') {
      throw new BadRequestException(`action must be 'pause' or 'resume'`);
    }
    // After both guards TS has narrowed service + action to their union types.
    await this.controlService.setConsumer({ service, action });
    return { service, action };
  }
}
