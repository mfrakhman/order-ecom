import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from '../../order-items/entities/order-item.entity';

export enum OrderStatus {
  CART = 'CART',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  AWAITING = 'AWAITING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ type: 'enum', enum: PaymentStatus, nullable: true, default: null })
  paymentStatus!: PaymentStatus | null;

  @Column({ type: 'text', nullable: true, default: null })
  qrString!: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  qrExpiresAt!: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @CreateDateColumn()
  createdAt!: Date;
}
