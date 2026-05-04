import { Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getWishlist(@Headers('x-user-id') userId: string) {
    return this.wishlistService.getWishlist(userId);
  }

  @Post(':skuId')
  add(@Headers('x-user-id') userId: string, @Param('skuId') skuId: string) {
    return this.wishlistService.add(userId, skuId);
  }

  @Delete(':skuId')
  async remove(@Headers('x-user-id') userId: string, @Param('skuId') skuId: string) {
    await this.wishlistService.remove(userId, skuId);
    return { message: 'Removed from wishlist' };
  }
}
