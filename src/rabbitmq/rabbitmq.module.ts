import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'RABBITMQ_ORDER_PUBLISHER',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          exchange: 'orders.event',
          exchangeType: 'topic',
          queue: '',
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class RabbitmqModule {}
