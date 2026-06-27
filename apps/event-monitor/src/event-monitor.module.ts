import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventMonitorController } from './event-monitor.controller';
import { EventMonitorGateway } from './event-monitor.gateway';
import { ConsumerLagService } from './consumer-lag.service';
import { ReplayController } from './replay.controller';
import { ReplayService } from './replay.service';

@Module({
  // ScheduleModule powers the @Interval poll in ConsumerLagService.
  imports: [ScheduleModule.forRoot()],
  controllers: [EventMonitorController, ReplayController],
  providers: [EventMonitorGateway, ConsumerLagService, ReplayService],
})
export class EventMonitorModule {}
