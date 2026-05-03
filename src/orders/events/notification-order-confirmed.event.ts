export class NotificationOrderConfirmedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly userEmail: string,
    public readonly amount: number,
    public readonly items: {
      skuId: string;
      quantity: number;
      price: number;
    }[],
  ) {}
}
