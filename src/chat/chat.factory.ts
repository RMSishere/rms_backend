import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginatedData } from 'src/common/interfaces';
import { SERVICES } from 'src/config/services';
import { BaseFactory } from 'src/lib/base.factory';

import { sendTemplateEmail } from 'src/util/sendMail';
import {
  MAIL_TEMPLATES,
  paginationLimit,
  NOTIFICATION_TYPES,
  NOTIFICATION_MESSAGE_TYPE,
} from '../config';
import { Chat, Counter, User } from '../lib/index';
import { ChatDto } from './chat.dto';
import * as mongoose from 'mongoose';
import { NotificationFactory } from '../notification/notification.factory';
import { getfullName } from 'src/util';

@Injectable()
export class ChatFactory extends BaseFactory {
  public chat: Chat[] = [];

  constructor(
    @InjectModel('chat') public readonly chatModel: Model<Chat>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
    public notificationfactory: NotificationFactory,
  ) {
    super(countersModel);
  }

  async getMessages(params: any, me: User): Promise<PaginatedData> {
    try {
      const recipient = params['recipient'];
      const messageFor = params['messageFor'];
      const messageForModel = params['messageForModel'];
      const skip = parseInt(params.skip) || 0;

      if (me && recipient) {
        // filter to get message where
        // sender is me and receiver is recipient
        // or sender is  recipient and receiver is me
        const chatFilter = {
          $or: [
            { sender: me, receiver: recipient },
            { sender: recipient, receiver: me },
          ],
          messageFor,
          messageForModel,
        };

        const count = await this.chatModel.countDocuments(chatFilter);

        const chats = await this.chatModel
          .find(chatFilter)
          .populate('sender')
          .populate('receiver')
          .skip(skip)
          .limit(50)
          .sort({ createdAt: 'desc' });

        const result = chats.map(res => new ChatDto(res));

        const finalData = { result, count, skip };

        return finalData;
      }
    } catch (err) {
      throw err;
    }
  }
async getAllIncomingMessages(
  skip: number,
  query: any,
  me: User,
): Promise<PaginatedData> {
  try {
    const customerTypes: string[] = query.customerType?.split(',');
    let chats = [];
    let count = 0;
    let unreadCount = 0;

    const receiverObjectId = new mongoose.Types.ObjectId(me._id);
    const secondFilter: any = {};

    if (customerTypes && customerTypes.length === 1) {
      if (customerTypes.includes('active')) {
        secondFilter['requests.hiredAffiliate'] = receiverObjectId;
      }
      if (customerTypes.includes('potential')) {
        secondFilter['requests.hiredAffiliate'] = null;
      }

      chats = await this.chatModel.aggregate([
        { $match: { receiver: receiverObjectId } },
        {
          $lookup: {
            from: 'requests',
            localField: 'messageFor',
            foreignField: '_id',
            as: 'requestData',
          },
        },
        { $match: secondFilter },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$sender',
            createdAt: { $first: '$createdAt' }, // latest createdAt
          },
        },
        {
          $lookup: {
            from: 'chat',
            let: { senderId: '$_id', latestTime: '$createdAt' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$sender', '$$senderId'] },
                      { $eq: ['$createdAt', '$$latestTime'] },
                    ],
                  },
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'sender',
                  foreignField: '_id',
                  as: 'senderData',
                },
              },
              {
                $lookup: {
                  from: 'requests',
                  localField: 'messageFor',
                  foreignField: '_id',
                  as: 'requestData',
                },
              },
              {
                $unwind: {
                  path: '$senderData',
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
            as: 'latestMessageData',
          },
        },
        { $unwind: '$latestMessageData' },
        { $replaceRoot: { newRoot: '$latestMessageData' } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: paginationLimit },
      ]);

      // Count of distinct senders
      const distinctSenders = await this.chatModel.distinct('sender', {
        receiver: me._id as any,
      });
      count = distinctSenders.length;

      // Count of unread messages by distinct senders
      const unreadSenders = await this.chatModel.distinct('sender', {
        receiver: me._id as any,
        read: null,
      });
      unreadCount = unreadSenders.length;

      chats = chats.map(dt => {
        dt.sender = dt.senderData || {};
        dt.messageFor = dt.requestData?.[0] || {};
        return dt;
      });
    } else {
      const chatFilter = { receiver: me._id as any };

      count = await this.chatModel.countDocuments(chatFilter);
      unreadCount = await this.chatModel.countDocuments({
        ...chatFilter,
        read: null,
      });

      chats = await this.chatModel
        .find(chatFilter)
        .populate('sender')
        .populate('messageFor')
        .skip(skip)
        .limit(paginationLimit)
        .sort({ createdAt: 'desc' });
    }

    const result = chats.map(res => new ChatDto(res));
    return {
      result,
      count,
      unreadCount,
      skip,
    };
  } catch (err) {
    throw err;
  }
}








  async newMessage(data: Chat): Promise<Chat> {
    try {


      data['id'] = await this.generateSequentialId('chat');
      data.createdBy = this.getCreatedBy(data.sender);
      const newMessage = new this.chatModel(data);
      let res = await newMessage.save();
      res = await res
        .populate('receiver')
        .populate('sender')
        .populate('messageFor')
        .execPopulate();
      const message = new ChatDto(res);

      if (message) {
        await this.notificationfactory.sendNotification(
          message.receiver,
          NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          {
            inApp: {
              message: {
                requestId: message.messageFor?.id,
                title: `New Message from ${getfullName(message.sender)}`,
                description: message.text,
                chatGroup: {
                  messageFor: message.messageFor,
                  messageForModel: message.messageForModel,
                  recipient: message.sender,
                },
                type: NOTIFICATION_MESSAGE_TYPE.CHAT_MESSAGE,
              },
            },
          },
        );
      }

      if (message && message.receiver.receiveMailForChat) {
        try {
          sendTemplateEmail(
            message.receiver.email,
            MAIL_TEMPLATES.NEW_MESSAGE,
            {
              message,
              service: SERVICES[message.messageFor.requestType],
            },
          );
        } catch (error) {
          // just log
        }
      }

      return message;
    } catch (err) {

      throw err;
    }
  }

  async readAllMessages(message: Chat): Promise<boolean> {
    try {
      const condition = {
        receiver: message.receiver,
        sender: message.sender,
        messageFor: message.messageFor,
        messageForModel: message.messageForModel,
        read: null,
      };
      const data = { read: new Date() };
      // data = this.generateUpdated(data, user.email)
      const newValue = { $set: data };
      const resUpdate = await this.chatModel.updateMany(condition, newValue);
      await this.notificationfactory.readUserNotifications(message.receiver, {
        'message.requestId': message.requestId,
        'message.type': NOTIFICATION_MESSAGE_TYPE.CHAT_MESSAGE,
      });

      return true;
    } catch (err) {

    }
  }
}
