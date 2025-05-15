import { Base } from './base';
import { User } from './user';

export interface Chat extends Base {
    sender: User;
    receiver: User;
    text: string;
    messageFor: any;
    messageForModel: string;
    file: { url: string, type: string };
    read: Date;
    requestId?: string;
}