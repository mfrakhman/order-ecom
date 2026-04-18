import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private dataSource: DataSource,
    private readonly rabbitmqService: RabbitmqService,
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string) {
    let savedOrder: Order;
    return this.dataSource.transaction(async (manager) => {
      const order = this.ordersRepository.createOrder({
        userId,
        status: OrderStatus.PENDING,
        items: dto.items.map((item) => ({
          skuId: item.skuId,
          quantity: item.quantity,
          price: item.price,
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
      this.logger.log(
        `[order.created] publishing orderId=${savedOrder.id} items=${savedOrder.items.length}`,
      );
      await this.rabbitmqService.publish('order.created', event);
      this.logger.log(`[order.created] published orderId=${savedOrder.id}`);

      return savedOrder;
    });
  }

  async getOrders() {
    return this.ordersRepository.findAll();
  }

  async getOrder(id: string) {
    const order = await this.ordersRepository.findById(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async getOrdersByUser(userId: string) {
    return this.ordersRepository.findByUserId(userId);
  }

  async markFailed(orderId: string, reason: string) {
    const affected = await this.ordersRepository.markAsFailed(orderId);
    this.logger.warn(
      `[order.failed] orderId=${orderId} reason="${reason}" affected=${affected}`,
    );
  }

  async markCompleted(orderId: string) {
    const affected = await this.ordersRepository.markAsCompleted(orderId);
    this.logger.log(`[order.completed] orderId=${orderId} affected=${affected}`);
  }
}
