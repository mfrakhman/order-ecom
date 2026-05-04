import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Wishlist } from '../entities/wishlist.entity';

@Injectable()
export class WishlistRepository {
  constructor(
    @InjectRepository(Wishlist)
    private readonly repo: Repository<Wishlist>,
  ) {}

  findActiveByUserId(userId: string): Promise<Wishlist[]> {
    return this.repo.find({
      where: { userId, convertedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(userId: string, skuId: string): Promise<Wishlist | null> {
    return this.repo.findOne({ where: { userId, skuId, convertedAt: IsNull() } });
  }

  async add(userId: string, skuId: string): Promise<Wishlist> {
    const existing = await this.findOne(userId, skuId);
    if (existing) return existing;
    const item = this.repo.create({ userId, skuId });
    return this.repo.save(item);
  }

  async remove(userId: string, skuId: string): Promise<void> {
    await this.repo.delete({ userId, skuId, convertedAt: IsNull() });
  }

  async convertItems(userId: string, skuIds: string[], orderId: string): Promise<void> {
    if (!skuIds.length) return;
    await this.repo.update(
      { userId, skuId: In(skuIds), convertedAt: IsNull() },
      { convertedAt: new Date(), convertedOrderId: orderId },
    );
  }
}
