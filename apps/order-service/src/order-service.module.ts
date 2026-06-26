import { Module } from '@nestjs/common';
import { OrderServiceController } from './order-service.controller';

@Module({
  imports: [],
  controllers: [OrderServiceController],
})
export class OrderServiceModule {}
