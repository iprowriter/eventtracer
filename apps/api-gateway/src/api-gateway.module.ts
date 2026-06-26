import { Module } from '@nestjs/common';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

@Module({
  imports: [],
  controllers: [ApiGatewayController, OrdersController],
  providers: [ApiGatewayService, OrdersService],
})
export class ApiGatewayModule {}
