import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  skuId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
