import { Base } from './base';
import { Request } from './request';

export interface Payment extends Base {
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
