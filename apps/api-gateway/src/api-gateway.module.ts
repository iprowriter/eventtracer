import { Module } from '@nestjs/common';

import { ControlModule } from './control/control.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [OrdersModule, ControlModule],
})
export class ApiGatewayModule {}
