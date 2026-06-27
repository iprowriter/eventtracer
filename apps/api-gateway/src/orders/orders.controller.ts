import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // 202 — we accepted the command, saga runs async
  createOrder(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<{ orderId: string }> {
    return this.ordersService.createOrder(dto, idempotencyKey);
  }

  // Idempotency demo (specs §7): re-deliver an existing order's order.created.
  // Still a command to the gateway (rule #1) — the browser never touches Kafka.
  @Post(':id/redeliver')
  @HttpCode(HttpStatus.ACCEPTED)
  redeliverOrder(@Param('id') id: string): Promise<{ orderId: string }> {
    return this.ordersService.redeliverOrder(id);
  }
}
