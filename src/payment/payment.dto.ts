import { Payment, BaseDto, Request } from '../lib/index';

export class PaymentDto extends BaseDto implements Payment {
    constructor(payment: Payment) {
        super(payment);

        this.payee = payment.payee;
        this.amount = payment.amount;
        this.currencyCode = payment.currencyCode;
        this.orderId = payment.orderId;
        this.captureId = payment.captureId;
        this.status = payment.status;
        this.request = payment.request;
        this.paymentForModel = payment.paymentForModel;
        this.transactionStatus = payment.transactionStatus;
        this.type = payment.type;
    }
    payee?: object | string;
    amount: number;
    currencyCode?: string;
    orderId?: string;
    captureId?: string;
    status?: string;
    request?: Request;
    paymentForModel: string;
    transactionStatus?: string;
    type: string;
}