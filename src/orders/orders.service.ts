import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { DataSource } from 'typeorm';
import { CreateOrderDto } from './dtos/create-order.dto';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { OrderItem } from 'src/order-items/entities/order-item.entity';
import { OrderCreatedEvent } from './events/order-created.event';
import { OrderAwaitingPaymentEvent } from './events/order-awaiting-payment.event';
import { NotificationOrderConfirmedEvent } from './events/notification-order-confirmed.event';
import { NotificationOrderAwaitingPaymentEvent } from './events/notification-order-awaiting-payment.event';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private dataSource: DataSource,
    private readonly rabbitmqService: RabbitmqService,
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string, userEmail?: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = this.ordersRepository.createOrder({
        userId,
        userEmail: userEmail ?? null,
        status: OrderStatus.PENDING,
        items: dto.items.map((item) => ({
          skuId: item.skuId,
          quantity: item.quantity,
          price: item.price,
        })),
      });
      const savedOrder = await this.ordersRepository.saveOrder(order, manager);
      const event = new OrderCreatedEvent(
        savedOrder.id,
        savedOrder.items.map((item: OrderItem) => ({ skuId: item.skuId, quantity: item.quantity })),
      );
      await this.rabbitmqService.publish('order.created', event);
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

  async markCancelled(orderId: string, reason: string) {
    const affected = await this.ordersRepository.markAsCancelled(orderId);
    this.logger.warn(`[order.cancelled] orderId=${orderId} reason="${reason}" affected=${affected}`);
  }

  async markCompleted(orderId: string) {
    const affected = await this.ordersRepository.markAsCompleted(orderId);
    this.logger.log(`[order.completed] orderId=${orderId} affected=${affected}`);
  }

  async markAwaitingPayment(orderId: string) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      this.logger.warn(`[order.awaiting_payment] order not found orderId=${orderId}`);
      return;
    }
    await this.ordersRepository.setPaymentStatus(orderId, PaymentStatus.AWAITING);
    const amount = order.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
    const event = new OrderAwaitingPaymentEvent(
      orderId,
      order.userId,
      amount,
      order.items.map(item => ({
        skuId: item.skuId,
        quantity: item.quantity,
        price: item.price ?? 0,
      })),
    );
    await this.rabbitmqService.publish('order.awaiting_payment', event);
    this.logger.log(`[order.awaiting_payment] published orderId=${orderId} amount=${amount}`);
  }

  async onQrReady(orderId: string, qrString: string, qrImageUrl: string, expiresAt: Date) {
    await this.ordersRepository.setQrData(orderId, qrString, qrImageUrl, expiresAt);
    this.logger.log(`[payment.qr_ready] QR stored for orderId=${orderId}`);
    const order = await this.ordersRepository.findById(orderId);
    if (order?.userEmail) {
      const amount = order.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
      const event = new NotificationOrderAwaitingPaymentEvent(
        orderId,
        order.userEmail,
        amount,
        order.items.map(item => ({ skuId: item.skuId, quantity: item.quantity, price: item.price ?? 0 })),
      );
      await this.rabbitmqService.publish('notification.order_awaiting_payment', event);
      this.logger.log(`[notification.order_awaiting_payment] published orderId=${orderId}`);
    }
  }

  async onPaymentConfirmed(orderId: string) {
    const order = await this.ordersRepository.findById(orderId);
    await this.ordersRepository.markAsCompleted(orderId);
    this.logger.log(`[payment.confirmed] orderId=${orderId} marked COMPLETED`);
    if (order && order.userEmail) {
      const amount = order.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
      const event = new NotificationOrderConfirmedEvent(
        orderId,
        order.userId,
        order.userEmail,
        amount,
        order.items.map(item => ({ skuId: item.skuId, quantity: item.quantity, price: item.price ?? 0 })),
      );
      await this.rabbitmqService.publish('notification.order_confirmed', event);
      this.logger.log(`[notification.order_confirmed] published orderId=${orderId}`);
    }
  }

  async onPaymentExpired(orderId: string) {
    await this.ordersRepository.cancelWithPaymentStatus(orderId, PaymentStatus.EXPIRED);
    this.logger.log(`[payment.expired] orderId=${orderId} marked CANCELLED/EXPIRED`);
  }

  async onPaymentFailed(orderId: string) {
    await this.ordersRepository.cancelWithPaymentStatus(orderId, PaymentStatus.FAILED);
    this.logger.log(`[payment.failed] orderId=${orderId} marked CANCELLED/FAILED`);
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

  async checkout(userId: string, prices: Record<string, number>, userEmail?: string): Promise<Order> {
    const cart = await this.getCart(userId);
    if (cart.items.length === 0) throw new BadRequestException('Cart is empty');
    const itemRepo = this.dataSource.getRepository(OrderItem);
    for (const item of cart.items) {
      const price = prices[item.skuId];
      if (price === undefined) throw new BadRequestException(`Missing price for SKU ${item.skuId}`);
      await itemRepo.update(item.id, { price });
    }
    await this.ordersRepository.updateStatus(cart.id, OrderStatus.PENDING);
    if (userEmail) await this.ordersRepository.setUserEmail(cart.id, userEmail);
    const order = (await this.ordersRepository.findById(cart.id))!;
    const event = new OrderCreatedEvent(
      order.id,
      order.items.map(item => ({ skuId: item.skuId, quantity: item.quantity })),
    );
    await this.rabbitmqService.publish('order.created', event);
    return order;
  }
}
