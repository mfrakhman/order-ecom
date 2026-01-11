import { Inject, Injectable } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { DataSource, DeepPartial } from 'typeorm';
import { CreateOrderDto } from './dtos/create-order.dto';
import { OrderStatus } from './entities/order.entity';
import { OrderItem } from 'src/order-items/entities/order-item.entity';
import { ClientProxy } from '@nestjs/microservices';
import { OrderCreatedEvent } from './events/order-created.event';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private dataSource: DataSource,
    @Inject('RABBITMQ_ORDER_PUBLISHER')
    private readonly client: ClientProxy,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    let savedOrder: Order;
    return this.dataSource.transaction(async (manager) => {
      const order = this.ordersRepository.createOrder({
        status: OrderStatus.PENDING,
        items: dto.items.map((item) => ({
          skuId: item.skuId,
          quantity: item.quantity,
        })),
      });

      savedOrder = await this.ordersRepository.saveOrder(order, manager);

      const event = new OrderCreatedEvent(
        savedOrder.id,
        savedOrder.items.map((item: OrderItem) => ({
          skuId: item.skuId,
          quantity: item.quantity,
        })),
      );
      this.client.emit('order.created', event);

      return savedOrder;
    });
  }
}
