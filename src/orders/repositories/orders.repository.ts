import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { DeepPartial, EntityManager, Repository } from 'typeorm';

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  createOrder(order: DeepPartial<Order>): Order {
    return this.ordersRepository.create(order);
  }

  async saveOrder(order: Order, manager?: EntityManager): Promise<Order> {
    if (manager) {
      return await manager.save(Order, order);
    }
    return await this.ordersRepository.save(order);
  }
}
