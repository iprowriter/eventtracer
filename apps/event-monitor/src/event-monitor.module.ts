import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventMonitorController } from './event-monitor.controller';
import { EventMonitorGateway } from './event-monitor.gateway';
import { ConsumerLagService } from './consumer-lag.service';

@Module({
  // ScheduleModule powers the @Interval poll in ConsumerLagService.
  imports: [ScheduleModule.forRoot()],
  controllers: [EventMonitorController],
  providers: [EventMonitorGateway, ConsumerLagService],
})
export class EventMonitorModule {}
