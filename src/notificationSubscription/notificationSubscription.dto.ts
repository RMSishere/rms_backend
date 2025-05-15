import { BaseDto, NotificationSubscription } from '../lib/index';

export class NotificationSubscriptionDto extends BaseDto implements NotificationSubscription {
  constructor(notificationSubscription: NotificationSubscription) {
    super(notificationSubscription);

    this.title = notificationSubscription.title;
    this.desc = notificationSubscription.desc;
    this.notificationChannels = notificationSubscription.notificationChannels;
    this.forRoles = notificationSubscription.forRoles;
  }

  title: string;
  desc: string;
  notificationChannels: string[];
  forRoles: number[];
}
