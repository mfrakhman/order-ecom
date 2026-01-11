import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderItem } from '../entities/order-item.entity';
import { DeepPartial, EntityManager, Repository } from 'typeorm';

@Injectable()
export class OrderItemRepository {
  constructor(
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
  ) {}

  create(items: DeepPartial<OrderItem>[]): OrderItem[] {
    return this.orderItemsRepository.create(items);
  }

  async saveOrdersItems(
    items: OrderItem[],
    manager?: EntityManager,
  ): Promise<OrderItem[]> {
    if (manager) {
      return await manager.save(OrderItem, items);
    }
    return await this.orderItemsRepository.save(items);
  }
}
