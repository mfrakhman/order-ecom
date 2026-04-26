import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';
import { DeepPartial, EntityManager, Not, Repository } from 'typeorm';

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
    if (manager) return await manager.save(Order, order);
    return await this.ordersRepository.save(order);
  }

  async findAll(): Promise<Order[]> {
    return this.ordersRepository.find({ relations: ['items'] });
  }

  async findById(id: string): Promise<Order | null> {
    return this.ordersRepository.findOne({ where: { id }, relations: ['items'] });
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { userId, status: Not(OrderStatus.CART) },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findCartByUserId(userId: string): Promise<Order | null> {
    return this.ordersRepository.findOne({
      where: { userId, status: OrderStatus.CART },
      relations: ['items'],
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await this.ordersRepository.update(id, { status });
  }

  async markAsCancelled(id: string): Promise<number> {
    const result = await this.ordersRepository
      .createQueryBuilder()
      .update(Order)
      .set({ status: OrderStatus.CANCELLED })
      .where('id = :id', { id })
      .execute();
    return result.affected ?? 0;
  }

  async markAsCompleted(id: string): Promise<number> {
    const result = await this.ordersRepository
      .createQueryBuilder()
      .update(Order)
      .set({ status: OrderStatus.COMPLETED, paymentStatus: PaymentStatus.PAID })
      .where('id = :id', { id })
      .execute();
    return result.affected ?? 0;
  }

  async setPaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<void> {
    await this.ordersRepository.update(id, { paymentStatus });
  }

  async cancelWithPaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<void> {
    await this.ordersRepository.update(id, { status: OrderStatus.CANCELLED, paymentStatus });
  }

  async setQrData(id: string, qrString: string, qrImageUrl: string, qrExpiresAt: Date): Promise<void> {
    await this.ordersRepository.update(id, { qrString, qrImageUrl, qrExpiresAt, paymentStatus: PaymentStatus.AWAITING });
  }
}
