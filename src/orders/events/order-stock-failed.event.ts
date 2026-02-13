export class OrderStockFailedEvent {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
    public readonly items: {
      skuId: string;
      quantity: number;
    }[],
  ) {}
}
