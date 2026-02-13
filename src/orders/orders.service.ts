import { Injectable } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { DataSource, DeepPartial } from 'typeorm';
import { CreateOrderDto } from './dtos/create-order.dto';
import { OrderStatus } from './entities/order.entity';
import { OrderItem } from 'src/order-items/entities/order-item.entity';
import { OrderCreatedEvent } from './events/order-created.event';
import { Order } from './entities/order.entity';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private dataSource: DataSource,
    private readonly rabbitmqService: RabbitmqService,
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
      console.log('[order.created] publishing', event);
      await this.rabbitmqService.publish('order.created', event);
      console.log('[order.created] published', savedOrder.id);

      return savedOrder;
    });
  }

  async markFailed(orderId: string, reason: string) {
    const affected = await this.ordersRepository.markAsFailed(orderId);
    console.log(`[order.failed] ${orderId} ${reason} affected=${affected}`);
  }
}
