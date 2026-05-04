import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wishlist } from './entities/wishlist.entity';
import { WishlistRepository } from './repositories/wishlist.repository';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Wishlist])],
  providers: [WishlistService, WishlistRepository],
  controllers: [WishlistController],
  exports: [WishlistService],
})
export class WishlistModule {}
