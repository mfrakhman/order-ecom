import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection?: amqplib.Connection;
  private channel?: amqplib.Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const rabbitUrl = this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://127.0.0.1:5672',
    );
    const exchange = this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'orders.event',
    );
    const exchangeType = this.configService.get<string>(
      'RABBITMQ_EXCHANGE_TYPE',
      'topic',
    );

    this.connection = await amqplib.connect(rabbitUrl);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(exchange, exchangeType, { durable: true });

    this.logger.log('[RabbitMQ] publisher ready');
  }

  async publish(routingKey: string, data: unknown) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }

    const exchange = this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'orders.event',
    );
    const payload = Buffer.from(JSON.stringify(data));
    this.channel.publish(exchange, routingKey, payload, { persistent: true });
    this.logger.log(`[RabbitMQ] published ${routingKey}`);
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
