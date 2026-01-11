export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly items: {
      skuId: string;
      quantity: number;
    }[],
  ) {}
}
