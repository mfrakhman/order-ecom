import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Wishlist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  skuId!: string;

  @Column({ type: 'timestamp', nullable: true, default: null })
  convertedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  convertedOrderId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
