import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { OrdersService } from 'src/orders/orders.service';

@Injectable()
export class RabbitmqConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqConsumer.name);
  private connection?: amqplib.Connection;
  private channel?: amqplib.Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  async onModuleInit() {
    const rabbitUrl = this.configService.get<string>('RABBITMQ_URL', 'amqp://127.0.0.1:5672');
    const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE', 'orders.event');
    const exchangeType = this.configService.get<string>('RABBITMQ_EXCHANGE_TYPE', 'topic');
    const queue = this.configService.get<string>('RABBITMQ_QUEUE_ORDERS', 'order-service');

    this.connection = await amqplib.connect(rabbitUrl);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(exchange, exchangeType, { durable: true });
    await this.channel.assertQueue(queue, { durable: true });

    await this.channel.bindQueue(queue, exchange, 'order.stock_reserved');
    await this.channel.bindQueue(queue, exchange, 'order.stock_failed');
    await this.channel.bindQueue(queue, exchange, 'payment.qr_ready');
    await this.channel.bindQueue(queue, exchange, 'payment.confirmed');
    await this.channel.bindQueue(queue, exchange, 'payment.expired');
    await this.channel.bindQueue(queue, exchange, 'payment.failed');

    this.logger.log('[RabbitMQ] consumer ready');

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const routingKey = msg.fields.routingKey;
        const payload = JSON.parse(msg.content.toString());

        this.logger.log(`[RabbitMQ] received ${routingKey}`);

        if (routingKey === 'order.stock_reserved') {
          await this.ordersService.markAwaitingPayment(payload.orderId);

        } else if (routingKey === 'order.stock_failed') {
          await this.ordersService.markCancelled(payload.orderId, payload.reason ?? 'Insufficient stock');

        } else if (routingKey === 'payment.qr_ready') {
          await this.ordersService.onQrReady(
            payload.orderId,
            payload.qrString,
            payload.qrImageUrl,
            new Date(payload.expiresAt),
          );

        } else if (routingKey === 'payment.confirmed') {
          await this.ordersService.onPaymentConfirmed(payload.orderId);

        } else if (routingKey === 'payment.expired') {
          await this.ordersService.onPaymentExpired(payload.orderId);

        } else if (routingKey === 'payment.failed') {
          await this.ordersService.onPaymentFailed(payload.orderId);

        } else {
          this.logger.warn(`Unhandled routing key: ${routingKey}`);
        }

        this.channel?.ack(msg);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Failed to process message: ${err.message}`, err.stack);
        this.channel?.nack(msg, false, false);
      }
    });
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
