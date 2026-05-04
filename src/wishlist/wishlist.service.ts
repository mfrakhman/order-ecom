import { Injectable } from '@nestjs/common';
import { WishlistRepository } from './repositories/wishlist.repository';

@Injectable()
export class WishlistService {
  constructor(private readonly wishlistRepo: WishlistRepository) {}

  getWishlist(userId: string) {
    return this.wishlistRepo.findActiveByUserId(userId);
  }

  add(userId: string, skuId: string) {
    return this.wishlistRepo.add(userId, skuId);
  }

  remove(userId: string, skuId: string) {
    return this.wishlistRepo.remove(userId, skuId);
  }

  async isWishlisted(userId: string, skuId: string): Promise<boolean> {
    const item = await this.wishlistRepo.findOne(userId, skuId);
    return !!item;
  }

  convertItems(userId: string, skuIds: string[], orderId: string) {
    return this.wishlistRepo.convertItems(userId, skuIds, orderId);
  }
}
