// import { NotificationSubscriptions } from './users.model';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BaseFactory } from '../lib/base.factory';
import { Counter, NotificationSubscription, User } from '../lib/index';
import { NotificationSubscriptionDto } from './notificationSubscription.dto';
import { USER_ROLES } from 'src/config';

@Injectable()
export class NotificationSubscriptionFactory extends BaseFactory {
  constructor(
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
    @InjectModel('NotificationSubscription')
    public readonly notificationSubscriptionModel: Model<
      NotificationSubscription
    >,
  ) {
    super(countersModel);
  }

  async addNotificationSubscription(
    data: NotificationSubscription,
  ): Promise<NotificationSubscription> {
    try {
      data['id'] = await this.generateSequentialId('NotificationSubscription');
      const newNotificationSubscription = new this.notificationSubscriptionModel(
        data,
      );
      const result = await newNotificationSubscription.save();
      const payload = new NotificationSubscriptionDto(result);
      return payload;
    } catch (err) {
      throw err;
    }
  }
async getAllNotificationSubscriptions(
  params: any,
  user: User,
): Promise<NotificationSubscription[]> {
  const filter = {
    isActive: true,
    ...(user.role !== USER_ROLES.ADMIN ? { forRoles: { $in: [user.role] } } : null),
  };

  console.log('User Role:', user.role);
  console.log('Filter being used to fetch subscriptions:', filter);

  try {
    const notificationSubscriptions = await this.notificationSubscriptionModel.find(
      filter,
    );
    console.log('Fetched Notification Subscriptions:', notificationSubscriptions);

    const result = notificationSubscriptions.map(
      res => new NotificationSubscriptionDto(res),
    );
    console.log('Mapped NotificationSubscriptionDto Result:', result);

    return result;
  } catch (error) {
    console.error('Error fetching notification subscriptions:', error);
    throw error;
  }
}
}
