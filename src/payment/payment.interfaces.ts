export interface PaymentData {
  amount: number,
  request?: string | object,
  paymentForModel: string,
  currencyCode?: string;
  type: string;
}