import { Base } from './base';

export interface NotificationSubscription extends Base {
    title: string;
    desc: string;
    notificationChannels: string[];
    forRoles: number[];
}
