import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dtos/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  @Get()
  async getOrders() {
    return this.ordersService.getOrders();
  }

  @Get('user/me')
  async getOrdersByUser(@Headers('x-user-id') userId: string) {
    return this.ordersService.getOrdersByUser(userId);
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @Post()
  async createOrder(
    @Body() dto: CreateOrderDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.ordersService.createOrder(dto, userId);
  }
}
