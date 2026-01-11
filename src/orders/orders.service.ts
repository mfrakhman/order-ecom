import { Injectable } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { DataSource, DeepPartial } from 'typeorm';
import { CreateOrderDto } from './dtos/create-order.dto';
import { OrderStatus } from './entities/order.entity';
import { OrderItem } from 'src/order-items/entities/order-item.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private dataSource: DataSource,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = this.ordersRepository.createOrder({
        status: OrderStatus.PENDING,
        items: dto.items.map((item) => ({
          skuId: item.skuId,
          quantity: item.quantity,
        })),
      });

      return await this.ordersRepository.saveOrder(order, manager);
    });
  }
}
