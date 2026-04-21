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

  @Column('decimal', { precision: 12, scale: 2, nullable: true, transformer: {
    to: (v: number | null) => v,
    from: (v: string | null) => (v !== null && v !== undefined) ? parseFloat(v) : null,
  }})
  price!: number | null;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'orderId' })
  order!: Order;
}
