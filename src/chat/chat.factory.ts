import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import * as mongoose from 'mongoose';

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
import { NotificationFactory } from '../notification/notification.factory';
import { getfullName } from 'src/util';

// DB type: sender/receiver/messageFor are ObjectId
import { ChatDB } from './chat.types';

@Injectable()
export class ChatFactory extends BaseFactory {
  public chat: Chat[] = [];

  constructor(
    @InjectModel('chat') public readonly chatModel: Model<ChatDB>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
    @InjectModel('users') public readonly userModel: Model<User>,
    @InjectModel('requests') public readonly requestModel: Model<any>, // or your Request interface
    public notificationfactory: NotificationFactory,
  ) {
    super(countersModel);
  }

  // --- helpers --------------------------------------------------------------

  private toObjectId(v: any): mongoose.Types.ObjectId {
    if (!v) return v;
    // already an ObjectId
    if (v instanceof mongoose.Types.ObjectId) return v;
    // populated document with _id
    if (typeof v === 'object' && v._id) return new mongoose.Types.ObjectId(String(v._id));
    // raw string
    return new mongoose.Types.ObjectId(String(v));
  }

  // --- messages between 2 users for a given request -------------------------

  async getMessages(params: any, me: User): Promise<PaginatedData> {
    try {
      const recipient = params['recipient'];         // id or object
      const messageFor = params['messageFor'];       // id or object
      const messageForModel = params['messageForModel'];
      const skip = parseInt(params.skip) || 0;

      if (!me || !recipient) {
        return { result: [], count: 0, skip };
      }

      const meId = this.toObjectId(me);
      const recId = this.toObjectId(recipient);
      const msgForId = this.toObjectId(messageFor);

      // Filter with ObjectIds (schema-accurate)
      const chatFilter: FilterQuery<ChatDB> = {
        $or: [
          { sender: meId, receiver: recId },
          { sender: recId, receiver: meId },
        ],
        messageFor: msgForId,
        messageForModel,
      };

      const count = await this.chatModel.countDocuments(chatFilter);

      const chats = await this.chatModel
        .find(chatFilter)
        .populate({ path: 'sender', model: this.userModel.modelName })
        .populate({ path: 'receiver', model: this.userModel.modelName })
        .skip(skip)
        .limit(50)
        .sort({ createdAt: -1 })
        .lean();

      const result = chats.map(res => new ChatDto(res as any));
      return { result, count, skip };
    } catch (err) {
      throw err;
    }
  }

  // --- inbox listing (latest per distinct sender) ---------------------------

  async getAllIncomingMessages(
    skip: number,
    query: any,
    me: { _id: string } | any,
  ): Promise<PaginatedData> {
    const log = new Logger('ChatFactory.getAllIncomingMessages');
    const t0 = Date.now();

    try {
      const customerTypes: string[] | undefined = query.customerType
        ? String(query.customerType).split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      const receiverObjectId = this.toObjectId(me?._id);

      // resolve actual collection names (prevents $lookup collection mismatches)
      const chatColl = this.chatModel.collection.collectionName;
      const userColl = this.userModel.collection.collectionName;
      const requestColl = this.requestModel.collection.collectionName;

      log.debug(
        `incoming params | skip=${skip} | customerTypes=${customerTypes?.join(',') ?? '(none)'} | receiver=${receiverObjectId}`,
      );

      let rows: any[] = [];
      let count = 0;
      let unreadCount = 0;

      if (customerTypes && customerTypes.length === 1) {
        // Build filter against looked-up requestData (array)
        const secondFilter: any = {};
        if (customerTypes.includes('active')) {
          secondFilter.requestData = { $elemMatch: { hiredAffiliate: receiverObjectId } };
        }
        if (customerTypes.includes('potential')) {
          secondFilter.requestData = { $elemMatch: { hiredAffiliate: null } };
        }

        const pipeline: any[] = [
          { $match: { receiver: receiverObjectId } },
          {
            $lookup: {
              from: requestColl,
              localField: 'messageFor',
              foreignField: '_id',
              as: 'requestData',
            },
          },
          ...(Object.keys(secondFilter).length ? [{ $match: secondFilter }] : []),
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$sender', createdAt: { $first: '$createdAt' } } },
          {
            $lookup: {
              from: chatColl,
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
                    from: userColl,
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'senderData',
                  },
                },
                {
                  $lookup: {
                    from: requestColl,
                    localField: 'messageFor',
                    foreignField: '_id',
                    as: 'requestData',
                  },
                },
                { $unwind: { path: '$senderData', preserveNullAndEmptyArrays: true } },
              ],
              as: 'latestMessageData',
            },
          },
          { $unwind: '$latestMessageData' },
          { $replaceRoot: { newRoot: '$latestMessageData' } },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: paginationLimit },
        ];

        rows = await this.chatModel.aggregate(pipeline);

        const fullCountRes = await this.chatModel.aggregate([
          { $match: { receiver: receiverObjectId } },
          {
            $lookup: {
              from: requestColl,
              localField: 'messageFor',
              foreignField: '_id',
              as: 'requestData',
            },
          },
          ...(Object.keys(secondFilter).length ? [{ $match: secondFilter }] : []),
          { $group: { _id: '$sender' } },
          { $count: 'total' },
        ]);
        count = fullCountRes?.[0]?.total ?? 0;

        const unreadRes = await this.chatModel.aggregate([
          { $match: { receiver: receiverObjectId, read: null } },
          {
            $lookup: {
              from: requestColl,
              localField: 'messageFor',
              foreignField: '_id',
              as: 'requestData',
            },
          },
          ...(Object.keys(secondFilter).length ? [{ $match: secondFilter }] : []),
          { $group: { _id: '$sender' } },
          { $count: 'total' },
        ]);
        unreadCount = unreadRes?.[0]?.total ?? 0;

        // normalize for DTO
        rows = rows.map(doc => {
          doc.sender = doc.senderData || null;
          doc.messageFor = doc.requestData?.[0] || null;
          delete doc.senderData;
          delete doc.requestData;
          return doc;
        });
      } else {
        // simple branch: filter by receiver and populate
        const chatFilter: FilterQuery<ChatDB> = { receiver: receiverObjectId };

        count = await this.chatModel.countDocuments(chatFilter);
        unreadCount = await this.chatModel.countDocuments({ ...chatFilter, read: null });

        rows = await this.chatModel
          .find(chatFilter)
          .populate({
            path: 'sender',
            model: this.userModel.modelName,
            select: 'firstName lastName avatar email role',
          })
          .populate({ path: 'messageFor' })
          .skip(skip)
          .limit(paginationLimit)
          .sort({ createdAt: -1 })
          .lean();
      }

      const result = rows.map(r => new ChatDto(r as any));
      const t1 = Date.now();
      log.log(
        `success | results=${result.length} | count=${count} | unread=${unreadCount} | skip=${skip} | durationMs=${t1 - t0}`,
      );

      return { result, count, unreadCount, skip };
    } catch (err) {
      const t1 = Date.now();
      const msg = err?.message || String(err);
      new Logger('ChatFactory.getAllIncomingMessages').error(
        `failed | durationMs=${t1 - t0} | error=${msg}`,
        err?.stack,
      );
      throw err;
    }
  }

  // Optional alt impl you had; unchanged (left here if you still call it)
  async getAllIncomingMessages2(
    skip: number,
    query: any,
    me: { _id: string },
  ): Promise<PaginatedData> {
    try {
      const customerTypes: string[] = query.customerType?.split(',');
      let chats: any[] = [];
      let count = 0;
      let unreadCount = 0;

      const receiverObjectId = this.toObjectId(me._id);

      if (customerTypes && customerTypes.length === 1) {
        chats = await this.chatModel.aggregate([
          { $match: { receiver: receiverObjectId } },
          {
            $lookup: {
              from: 'requests',
              localField: 'messageFor',
              foreignField: '_id',
              as: 'messageFor',
            },
          },
          {
            $unwind: {
              path: '$messageFor',
              preserveNullAndEmptyArrays: true,
            },
          },
          ...(customerTypes.includes('active')
            ? [
                {
                  $match: {
                    $expr: {
                      $eq: ['$messageFor.hiredAffiliate', receiverObjectId],
                    },
                  },
                },
              ]
            : []),
          ...(customerTypes.includes('potential')
            ? [
                {
                  $match: {
                    $or: [
                      { messageFor: null },
                      {
                        $and: [
                          { 'messageFor.hiredAffiliate': { $exists: true } },
                          { 'messageFor.hiredAffiliate': null },
                        ],
                      },
                    ],
                  },
                },
              ]
            : []),
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: '$sender',
              doc: { $first: '$$ROOT' },
            },
          },
          { $replaceRoot: { newRoot: '$doc' } },
          {
            $lookup: {
              from: 'users',
              localField: 'sender',
              foreignField: '_id',
              as: 'senderData',
            },
          },
          {
            $unwind: {
              path: '$senderData',
              preserveNullAndEmptyArrays: true,
            },
          },
          { $addFields: { sender: '$senderData' } },
          { $project: { senderData: 0 } },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: paginationLimit },
        ]);

        const distinctSenders = await this.chatModel.distinct('sender', {
          receiver: receiverObjectId,
        } as any);
        count = distinctSenders.length;

        const unreadSenders = await this.chatModel.distinct('sender', {
          receiver: receiverObjectId,
          read: null,
        } as any);
        unreadCount = unreadSenders.length;
      } else {
        const chatFilter: FilterQuery<ChatDB> = { receiver: receiverObjectId };

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
          .sort({ createdAt: -1 });
      }

      const result = chats.map(res => new ChatDto(res));
      return { result, count, unreadCount, skip };
    } catch (err) {
      throw err;
    }
  }

  // --- create message (kept behavior; minimal typing/coercion) --------------

  async newMessage(data: Chat): Promise<Chat> {
    try {
      // Ensure DB fields are ObjectIds; keep original data shape otherwise
      const payload: any = {
        ...data,
        sender: this.toObjectId((data as any).sender),
        receiver: this.toObjectId((data as any).receiver),
        messageFor: this.toObjectId((data as any).messageFor),
      };

      payload['id'] = await this.generateSequentialId('chat');
      payload.createdBy = this.getCreatedBy(payload.sender);

      const newMessage = new this.chatModel(payload);
      let res: any = await newMessage.save();

      // Keep your execPopulate flow (casted to satisfy TS/mongoose version diff)
      if (typeof res.populate === 'function') {
        res = await (res as any)
          .populate('receiver')
          .populate('sender')
          .populate('messageFor')
          .execPopulate?.();
      }

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

      if (message && (message as any).receiver?.receiveMailForChat) {
        try {
          sendTemplateEmail(
            (message as any).receiver.email,
            MAIL_TEMPLATES.NEW_MESSAGE,
            {
              message,
              service: SERVICES[(message as any).messageFor?.requestType],
            },
          );
        } catch {
          // swallow mail errors
        }
      }

      return message;
    } catch (err) {
      throw err;
    }
  }

  // --- mark messages as read -----------------------------------------------

  async readAllMessages(message: Chat): Promise<boolean> {
    try {
      // Convert potential User objects or strings to ObjectId for the filter
      const condition: FilterQuery<ChatDB> = {
        receiver: this.toObjectId((message as any).receiver),
        sender: this.toObjectId((message as any).sender),
        messageFor: this.toObjectId((message as any).messageFor),
        messageForModel: (message as any).messageForModel,
        read: null,
      };

      const data = { read: new Date() };
      const newValue = { $set: data };

      await this.chatModel.updateMany(condition, newValue);

      await this.notificationfactory.readUserNotifications(
        (message as any).receiver,
        {
          'message.requestId': (message as any).requestId,
          'message.type': NOTIFICATION_MESSAGE_TYPE.CHAT_MESSAGE,
        },
      );

      return true;
    } catch (err) {
      // keep original silent failure behavior
      return false;
    }
  }
}
