import { Notification, BaseDto } from '../lib/index';

export class NotificationDto extends BaseDto implements Notification {
  constructor(notification: Notification) {
    super(notification);

    this.recipient = notification.recipient;
    this.message = notification.message;
    this.type = notification.type;
    this.read = notification.read;
  }

  recipient: Object; // user ref
  message: Object;
  type: string;
  read?: Date;
}
