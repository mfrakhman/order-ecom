import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrdersRepository } from './repositories/orders.repository';
import { RabbitmqModule } from 'src/rabbitmq/rabbitmq.module';
import { RabbitmqConsumer } from 'src/rabbitmq/rabbitmq.consumer';
import { WishlistModule } from 'src/wishlist/wishlist.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), RabbitmqModule, WishlistModule],
  providers: [OrdersService, OrdersRepository, RabbitmqConsumer],
  controllers: [OrdersController],
})
export class OrdersModule {}
