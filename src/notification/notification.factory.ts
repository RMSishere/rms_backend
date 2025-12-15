import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';

import { APIMessage, APIMessageTypes } from 'src/common/dto';
import { PaginatedData } from 'src/common/interfaces';

import { NOTIFICATION_MESSAGE_TYPE, paginationLimit } from '../config';
import { BaseFactory } from '../lib/base.factory';
import { Counter, Notification, User } from '../lib/index';
import { NotificationDto } from './notification.dto';
import { sendBulkTextMessage } from 'src/util/twilio';
import { sendTemplateEmail } from 'src/util/sendMail';

/**
 * ✅ Push is optional: pass a function from wherever you already have it.
 * Example wiring (in module providers):
 * {
 *   provide: 'PUSH_SENDER',
 *   useValue: sendPushNotificationToUser,
 * }
 */
type PushPayload = { title: string; body: string; data?: any };
type PushSenderFn = (
  user: any,
  payload: PushPayload,
  opts?: { quietHours?: boolean },
) => Promise<any>;

interface NotificationOptions {
  inApp?: { message: object };
  email?: { locals: object; template: string };
  text?: { message: string };

  // ✅ PUSH added
  push?: {
    title: string;
    body: string;
    data?: any;
    quietHours?: boolean;
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
    @InjectModel('counters')
    public readonly countersModel: Model<Counter>,

    // ✅ IMPORTANT: keep as Model<any> to avoid TS overload issues
    @InjectModel('users')
    public readonly userModel: Model<any>,

    /**
     * ✅ OPTIONAL push sender injection (no new file)
     * If you don't register it, PUSH just silently skips.
     */
    @Optional()
    @Inject('PUSH_SENDER')
    private readonly pushSender?: PushSenderFn,
  ) {
    super(countersModel);
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private isUser(obj: any): obj is User {
    return (
      !!obj &&
      typeof obj === 'object' &&
      ('email' in obj || 'phoneNumber' in obj || '_id' in obj)
    );
  }

  private async resolveRecipients(
    recipients: User | User[] | string | string[],
  ): Promise<User[]> {
    if (!recipients) return [];

    // User[]
    if (Array.isArray(recipients) && recipients.length && this.isUser(recipients[0])) {
      return recipients as User[];
    }

    // User
    if (!Array.isArray(recipients) && this.isUser(recipients)) {
      return [recipients as User];
    }

    // IDs (string | string[])
    const ids = Array.isArray(recipients) ? recipients : [recipients];

    const stringIds = ids.filter(
      (x): x is string => typeof x === 'string' && x.length > 0,
    );
    if (!stringIds.length) return [];

    const objectIds = stringIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    if (!objectIds.length) return [];

    // ✅ Fix TS2769: force FilterQuery typing so mongoose picks correct overload
    const filter: FilterQuery<any> = { _id: { $in: objectIds } };
    const users = await this.userModel.find(filter).lean();

    return users as any;
  }

  /* ------------------------------------------------------------------ */
  /* MAIN                                                               */
  /* ------------------------------------------------------------------ */

  async sendNotification(
    recipients: User | User[] | string | string[],
    notificationType: NotificationType,
    options: NotificationOptions,
  ): Promise<string> {
    const resolvedUsers = await this.resolveRecipients(recipients);
    if (!resolvedUsers.length) return;

    // ✅ In-app goes out regardless of subscription (matches your previous behavior)
    if (options.inApp?.message) {
      await this.sendInAppNotification(
        options.inApp.message,
        resolvedUsers,
        notificationType,
      );
    }

    // ✅ Email/SMS/Push should respect subscription
    const filteredUsers = this.getFilteredUsersForNotification(
      resolvedUsers,
      notificationType,
    );

    if (!filteredUsers?.length) return;

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

    // ✅ PUSH (optional; safe even if not wired)
    if (options.push?.title && options.push?.body) {
      await this.sendPushNotification(
        filteredUsers,
        {
          title: options.push.title,
          body: options.push.body,
          data: options.push.data || {},
        },
        { quietHours: options.push.quietHours ?? true },
      );
    }

    return 'SUCCESS';
  }

  /* ------------------------------------------------------------------ */
  /* In-App                                                             */
  /* ------------------------------------------------------------------ */

  async sendInAppNotification(
    message: object,
    recipient: User | User[],
    notificationType: NotificationType,
  ): Promise<string> {
    const recipients = Array.isArray(recipient) ? recipient : [recipient];

    await this.notificationModel.insertMany(
      recipients.map(r => ({
        recipient: r,
        type: notificationType.type,
        message,
      })),
    );

    return 'SUCCESS';
  }

  /* ------------------------------------------------------------------ */
  /* SMS                                                                */
  /* ------------------------------------------------------------------ */

  async sendTextNotification(message: string, recipients: User | User[]): Promise<void> {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    const numbers = list.map(dt => dt.phoneNumber).filter(Boolean);

    if (!numbers.length) return;

    await sendBulkTextMessage(message, numbers);
  }

  /* ------------------------------------------------------------------ */
  /* Email                                                              */
  /* ------------------------------------------------------------------ */

  async sendEmailNotification(
    locals: object,
    template: string,
    recipient: User | Array<User>,
  ): Promise<void> {
    const list = Array.isArray(recipient) ? recipient : [recipient];
    const to = list.map(dt => dt.email).filter(Boolean);

    if (!to.length) return;

    await sendTemplateEmail(to, template, locals);
  }

  /* ------------------------------------------------------------------ */
  /* PUSH                                                               */
  /* ------------------------------------------------------------------ */

  async sendPushNotification(
    recipients: User | User[],
    payload: PushPayload,
    opts?: { quietHours?: boolean },
  ): Promise<void> {
    // ✅ If you haven't wired push sender yet, don’t crash
    if (!this.pushSender) {
      console.warn('⚠️ Push sender not wired. Skipping push.');
      return;
    }

    const list = Array.isArray(recipients) ? recipients : [recipients];

    for (const user of list) {
      try {
        await this.pushSender(user as any, payload, {
          quietHours: opts?.quietHours ?? true,
        });
      } catch (err: any) {
        console.error('⚠️ Push failed:', err?.message || err);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Fetch / Read                                                       */
  /* ------------------------------------------------------------------ */

  async getUserNotificatons(params: any, user: User): Promise<PaginatedData> {
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

    // ✅ PaginatedData mismatch fix: keep required fields + optional meta
    return {
      result: resDto,
      count: resultCount,
      skip,
      // safe extra field (if PaginatedData doesn't support it, TS cast avoids compile fail)
      ...( { meta: { messageNotificationCount: msgNotifiCount } } as any ),
    } as any;
  }

  async readNotification(id: string): Promise<APIMessage> {
    const condition = { _id: id };
    const newValue = { $set: { read: new Date() } };
    const resUpdate = await this.notificationModel.updateOne(condition, newValue);

    // mongoose v5/v6 compatibility
    const n = (resUpdate as any).n ?? (resUpdate as any).matchedCount ?? 0;

    if (n === 1) {
      return new APIMessage('Read Notification Success', APIMessageTypes.SUCCESS);
    }

    return new APIMessage('Could not read notification', APIMessageTypes.ERROR);
  }

  async readUserNotifications(recipient: User, condition: any): Promise<void> {
    if (!condition) return;

    const newValue = { $set: { read: new Date() } };
    await this.notificationModel.updateMany({ recipient, ...condition }, newValue);
  }

  /* ------------------------------------------------------------------ */
  /* Subscription filter                                                */
  /* ------------------------------------------------------------------ */

  getFilteredUsersForNotification(
    users: User | User[],
    notificationType: NotificationType,
  ): User[] {
    const list = Array.isArray(users) ? users : [users];

    return list.filter(dt => {
      return (
        dt.notificationSubscriptions?.findIndex?.(
          s => s.title === notificationType.title,
        ) >= 0
      );
    });
  }
}
