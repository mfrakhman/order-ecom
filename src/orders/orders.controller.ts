import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
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

  @Get('cart')
  async getCart(@Headers('x-user-id') userId: string) {
    return this.ordersService.getCart(userId);
  }

  @Delete('cart')
  async clearCart(@Headers('x-user-id') userId: string) {
    await this.ordersService.clearCart(userId);
    return { message: 'Cart cleared' };
  }

  @Post('cart/items')
  async addItem(
    @Headers('x-user-id') userId: string,
    @Body() body: { skuId: string; quantity: number },
  ) {
    return this.ordersService.addItem(userId, body.skuId, body.quantity ?? 1);
  }

  @Patch('cart/items/:skuId')
  async updateItem(
    @Headers('x-user-id') userId: string,
    @Param('skuId') skuId: string,
    @Body() body: { quantity: number },
  ) {
    return this.ordersService.updateItem(userId, skuId, body.quantity);
  }

  @Delete('cart/items/:skuId')
  async removeItem(
    @Headers('x-user-id') userId: string,
    @Param('skuId') skuId: string,
  ) {
    return this.ordersService.removeItem(userId, skuId);
  }

  @Post('cart/checkout')
  async checkout(
    @Headers('x-user-id') userId: string,
    @Body() body: { prices: Record<string, number> },
  ) {
    return this.ordersService.checkout(userId, body.prices);
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
