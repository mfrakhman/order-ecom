import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  skuId!: string;

  @Column()
  quantity!: number;

  @Column('decimal', { precision: 12, scale: 2, transformer: {
    to: (v: number) => v,
    from: (v: string) => parseFloat(v),
  }})
  price!: number;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'orderId' })
  order!: Order;
}
