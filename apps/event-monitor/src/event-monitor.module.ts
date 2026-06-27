import { Module } from '@nestjs/common';
import { EventMonitorController } from './event-monitor.controller';
import { EventMonitorGateway } from './event-monitor.gateway';

@Module({
  controllers: [EventMonitorController],
  providers: [EventMonitorGateway],
})
export class EventMonitorModule {}
