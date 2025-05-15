import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APIMessage, APIMessageTypes } from 'src/common/dto';
import { PaginatedData } from 'src/common/interfaces';

import { NOTIFICATION_MESSAGE_TYPE, paginationLimit } from '../config';
import { BaseFactory } from '../lib/base.factory';
import { Counter, Notification, User } from '../lib/index';
import { NotificationDto } from './notification.dto';
import { sendBulkTextMessage } from 'src/util/twilio';
import { sendTemplateEmail } from 'src/util/sendMail';

interface NotificationOptions {
  inApp?: {
    message: object;
  };
  email?: {
    locals: object;
    template: string;
  };
  text?: {
    message: string;
  };
}

interface NotificationType {
  title: string;
  type?: string;
}

@Injectable()
export class NotificationFactory extends BaseFactory {
  constructor(
    @InjectModel('notification')
    public readonly notificationModel: Model<Notification>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
  ) {
    super(countersModel);
  }

  async sendNotification(
    recipients: User | User[],
    notificationType: NotificationType,
    options: NotificationOptions,
  ): Promise<string> {
    try {


      if (options.inApp?.message) {
        await this.sendInAppNotification(
          options.inApp.message,
          recipients,
          notificationType,
        );
      }

      const filteredUsers = this.getFilteredUsersForNotification(
        recipients,
        notificationType,
      );

      if (!filteredUsers?.length) {
        return;
      }

      if (options.email) {
        await this.sendEmailNotification(
          options.email.locals,
          options.email.template,
          filteredUsers,
        );
      }

      if (options.text) {
        await this.sendTextNotification(options.text.message, filteredUsers);
      }

      return 'SUCCESS';
    } catch (err) {
      throw err;
    }
  }

  async sendInAppNotification(
    message: object,
    recipient: User | User[],
    notifiicationType: NotificationType,
  ): Promise<string> {
    const recipients = Array.isArray(recipient) ? recipient : [recipient];
    try {
      this.notificationModel.insertMany(
        recipients.map(r => ({
          recipient: r,
          type: notifiicationType.type,
          message,
        })),
      );

      // TODO: emit update notification event to users

      return 'SUCCESS';
    } catch (err) {
      throw err;
    }
  }

  async sendTextNotification(
    message: string,
    recipients: User | User[],
  ): Promise<void> {
    try {
      let numbers: string | string[];
      if (Array.isArray(recipients)) {
        numbers = recipients.map(dt => dt.phoneNumber);
      } else {
        numbers = [recipients.phoneNumber];
      }
      await sendBulkTextMessage(message, numbers);
    } catch (err) {
      throw err;
    }
  }

  async sendEmailNotification(
    locals: object,
    template: string,
    recipient: User | Array<User>,
  ): Promise<void> {
    try {
      let to: string | string[];
      if (Array.isArray(recipient)) {
        to = recipient.map(dt => dt.email);
      } else {
        to = recipient.email;
      }
      await sendTemplateEmail(to, template, locals);
    } catch (err) {
      throw err;
    }
  }

  async getUserNotificatons(params: any, user: User): Promise<PaginatedData> {
    try {
      const skip = parseInt(params.skip) || 0;
      const query = { recipient: user, read: null };
      const resultCount = await this.notificationModel.countDocuments(query);
      const msgNotifiCount = await this.notificationModel.countDocuments({
        ...query,
        'message.type': NOTIFICATION_MESSAGE_TYPE.CHAT_MESSAGE,
      });

      const result = await this.notificationModel
        .find(query)
        .limit(paginationLimit)
        .skip(skip)
        .sort({ createdAt: 'desc' })
        .exec();
      const resDto = result.map(res => new NotificationDto(res));
      const finalData = {
        result: resDto,
        count: resultCount,
        messageNotificationCount: msgNotifiCount,
        skip,
      };

      return finalData;
    } catch (err) {


      throw err;
    }
  }

  async readNotification(id: string): Promise<APIMessage> {
    try {
      const condition = { _id: id };
      const newValue = { $set: { read: new Date() } };
      const resUpdate = await this.notificationModel.updateOne(
        condition,
        newValue,
      );
      if (resUpdate && resUpdate.n == 1) {
        return new APIMessage(
          'Read Notification Success',
          APIMessageTypes.SUCCESS,
        );
      } else {
        return new APIMessage(
          'Could not read notification',
          APIMessageTypes.ERROR,
        );
      }
    } catch (err) {}
  }

  async readUserNotifications(recipient: User, condition: any): Promise<void> {
    if (condition) {
      const newValue = { $set: { read: new Date() } };
      const res = await this.notificationModel.updateMany(
        { recipient, ...condition },
        newValue,
      );

    }
  }

  getFilteredUsersForNotification(
    users: User | User[],
    notificationType: NotificationType,
  ): User[] {
    if (Array.isArray(users)) {
      return users.filter(dt => {
        if (
          dt.notificationSubscriptions?.findIndex?.(
            dt => dt.title === notificationType.title,
          ) >= 0
        ) {
          return true;
        }
        return false;
      });
    } else {
      if (
        users.notificationSubscriptions?.findIndex?.(
          dt => dt.title === notificationType.title,
        ) >= 0
      ) {
        return [users];
      }
      return;
    }
  }
}
