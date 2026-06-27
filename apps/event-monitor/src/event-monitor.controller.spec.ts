import { Test, TestingModule } from '@nestjs/testing';
import { EventMonitorController } from './event-monitor.controller';
import { EventMonitorService } from './event-monitor.service';

describe('EventMonitorController', () => {
  let eventMonitorController: EventMonitorController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EventMonitorController],
      providers: [EventMonitorService],
    }).compile();

    eventMonitorController = app.get<EventMonitorController>(EventMonitorController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(eventMonitorController.getHello()).toBe('Hello World!');
    });
  });
});
