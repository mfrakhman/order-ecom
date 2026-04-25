export class OrderAwaitingPaymentEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly items: {
      skuId: string;
      quantity: number;
      price: number;
    }[],
  ) {}
}
