import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { DataSource } from 'typeorm';
import { CreateOrderDto } from './dtos/create-order.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from 'src/order-items/entities/order-item.entity';
import { OrderCreatedEvent } from './events/order-created.event';
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
        savedOrder.items.map((item: OrderItem) => ({ skuId: item.skuId, quantity: item.quantity })),
      );
      this.logger.log(`[order.created] publishing orderId=${savedOrder.id} items=${savedOrder.items.length}`);
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
    this.logger.warn(`[order.failed] orderId=${orderId} reason="${reason}" affected=${affected}`);
  }

  async markCompleted(orderId: string) {
    const affected = await this.ordersRepository.markAsCompleted(orderId);
    this.logger.log(`[order.completed] orderId=${orderId} affected=${affected}`);
  }

  // Cart methods

  async getCart(userId: string): Promise<Order> {
    let cart = await this.ordersRepository.findCartByUserId(userId);
    if (!cart) {
      const newCart = this.ordersRepository.createOrder({ userId, status: OrderStatus.CART, items: [] });
      await this.ordersRepository.saveOrder(newCart);
      cart = (await this.ordersRepository.findCartByUserId(userId))!;
    }
    return cart;
  }

  async addItem(userId: string, skuId: string, quantity: number): Promise<Order> {
    const cart = await this.getCart(userId);
    const itemRepo = this.dataSource.getRepository(OrderItem);
    const existing = cart.items.find(i => i.skuId === skuId);
    if (existing) {
      await itemRepo.update(existing.id, { quantity: existing.quantity + quantity });
    } else {
      const item = itemRepo.create({ skuId, quantity, price: null, order: { id: cart.id } });
      await itemRepo.save(item);
    }
    return (await this.ordersRepository.findCartByUserId(userId))!;
  }

  async updateItem(userId: string, skuId: string, quantity: number): Promise<Order> {
    const cart = await this.getCart(userId);
    const itemRepo = this.dataSource.getRepository(OrderItem);
    const item = cart.items.find(i => i.skuId === skuId);
    if (!item) throw new NotFoundException('Item not found in cart');
    if (quantity <= 0) {
      await itemRepo.delete(item.id);
    } else {
      await itemRepo.update(item.id, { quantity });
    }
    return (await this.ordersRepository.findCartByUserId(userId))!;
  }

  async removeItem(userId: string, skuId: string): Promise<Order> {
    const cart = await this.getCart(userId);
    const itemRepo = this.dataSource.getRepository(OrderItem);
    const item = cart.items.find(i => i.skuId === skuId);
    if (!item) throw new NotFoundException('Item not found in cart');
    await itemRepo.delete(item.id);
    return (await this.ordersRepository.findCartByUserId(userId))!;
  }

  async clearCart(userId: string): Promise<void> {
    const cart = await this.getCart(userId);
    const itemRepo = this.dataSource.getRepository(OrderItem);
    if (cart.items.length > 0) {
      await itemRepo.delete(cart.items.map(i => i.id));
    }
  }

  async checkout(userId: string, prices: Record<string, number>): Promise<Order> {
    const cart = await this.getCart(userId);
    if (cart.items.length === 0) throw new BadRequestException('Cart is empty');
    const itemRepo = this.dataSource.getRepository(OrderItem);
    for (const item of cart.items) {
      const price = prices[item.skuId];
      if (price === undefined) throw new BadRequestException(`Missing price for SKU ${item.skuId}`);
      await itemRepo.update(item.id, { price });
    }
    await this.ordersRepository.updateStatus(cart.id, OrderStatus.PENDING);
    const order = (await this.ordersRepository.findById(cart.id))!;
    const event = new OrderCreatedEvent(
      order.id,
      order.items.map(item => ({ skuId: item.skuId, quantity: item.quantity })),
    );
    this.logger.log(`[order.created] publishing orderId=${order.id} items=${order.items.length}`);
    await this.rabbitmqService.publish('order.created', event);
    return order;
  }
}
