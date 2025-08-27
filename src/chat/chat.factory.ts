import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import * as mongoose from 'mongoose';

import { PaginatedData } from 'src/common/interfaces';
import { SERVICES } from 'src/config/services';
import { BaseFactory } from 'src/lib/base.factory';
import { IncomingChatDto, ChatDto } from './chat.dto';

import { sendTemplateEmail } from 'src/util/sendMail';
import {
  MAIL_TEMPLATES,
  paginationLimit,
  NOTIFICATION_TYPES,
  NOTIFICATION_MESSAGE_TYPE,
} from '../config';

import { Chat, Counter, User } from '../lib/index';
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
    @InjectModel('request') public readonly requestModel: Model<any>, // <-- singular
    public notificationfactory: NotificationFactory,
  ) {
    super(countersModel);
    console.log('[ChatFactory] constructed');
  }

  // ---------------- helpers ----------------

  private toObjectId(v: any): mongoose.Types.ObjectId {
    if (!v) return v;
    if (v instanceof mongoose.Types.ObjectId) return v;
    if (typeof v === 'object' && (v as any)._id) return new mongoose.Types.ObjectId(String((v as any)._id));
    return new mongoose.Types.ObjectId(String(v));
  }

  private toObjectIdSafe(v: any): Types.ObjectId | null {
    try {
      if (!v) return null;
      if (v instanceof Types.ObjectId) return v;
      if (typeof v === 'object' && (v as any)._id) return new Types.ObjectId(String((v as any)._id));
      const s = String(v);
      if (!/^[a-f0-9]{24}$/i.test(s)) return null;
      return new Types.ObjectId(s);
    } catch {
      return null;
    }
  }

  private debugVal = (v: any) =>
    JSON.stringify(
      v,
      (_, val) => {
        if (val && typeof val === 'object') {
          if (typeof (val as any).toHexString === 'function') return (val as any).toHexString();
          if ((val as any)?._bsontype === 'ObjectID' && typeof (val as any).toString === 'function')
            return (val as any).toString();
          if (val instanceof Date) return val.toISOString();
        }
        return val;
      },
      2,
    );

  private isObjectIdLike = (v: any) =>
    v &&
    (v instanceof Types.ObjectId ||
      (v as any)?._bsontype === 'ObjectID' ||
      typeof (v as any)?.toHexString === 'function' ||
      /^[a-f0-9]{24}$/i.test(String(v)));

  private async manualPopulateSender(
    rows: any[],
    log: Logger,
  ): Promise<void> {
    console.log('[manualPopulateSender] start with rows=', rows?.length);
    const missing = rows.filter((r: any) => !r?.sender && (r?.senderFallback || r?.senderOriginal));
    if (!missing.length) {
      console.log('[manualPopulateSender] nothing to hydrate');
      return;
    }

    // Collect candidate ids (ObjectId | string)
    const idsRaw = [
      ...new Set(
        missing
          .map((c: any) => c.senderFallback ?? c.senderOriginal)
          .map((s: any) => (typeof s === 'object' && s?._id ? s._id : s))
          .filter(Boolean),
      ),
    ];

    // Normalize to ObjectId where possible
    const idsObj: Types.ObjectId[] = idsRaw
      .map((x) => this.toObjectIdSafe(x))
      .filter(Boolean) as Types.ObjectId[];

    if (!idsObj.length) {
      console.warn(`manualPopulateSender: nothing to lookup (all invalid ids)`);
      log.warn(`manualPopulateSender: nothing to lookup (all invalid ids)`);
      return;
    }

    // 🔧 Convert to strings so FilterQuery<User> is happy
    const idsStr = idsObj.map((x) => x.toString());
    console.log('[manualPopulateSender] idsStr to fetch=', idsStr);

    const t0 = Date.now();
    const users = await this.userModel
      .find({ _id: { $in: idsObj as any } } as any) // force ObjectIds and cast filter as any
      .select('_id firstName lastName avatar email role id')
      .lean();

    console.log('[manualPopulateSender] fetched users len=', users.length, 'ms=', Date.now() - t0, ' idsObj=', idsObj);
    const byId = new Map(users.map((u: any) => [String(u._id), u]));

    let attached = 0;
    missing.forEach((row: any) => {
      const key = String(
        typeof row.senderFallback === 'object' && row.senderFallback?._id
          ? row.senderFallback._id
          : row.senderFallback ?? row.senderOriginal,
      );
      const u = byId.get(key) || byId.get(this.toObjectIdSafe(key)?.toString?.() || '');
      if (u) {
        row.sender = u;
        attached++;
      }
    });

    console.log('[manualPopulateSender] attached=', attached);
    log.debug(
      `manualPopulateSender: hydrated=${users.length} rows in ${Date.now() - t0}ms | requestedIds=${idsObj.length}`,
    );
  }

  private async debugFirstRows(rows: any[], log: Logger, label: string) {
    console.log(`[debugFirstRows] ${label} | sample=`, (rows || []).slice(0, 2));
    (rows.slice(0, 5) || []).forEach((doc: any, i) => {
      const s = doc?.sender;
      const sf = doc?.senderFallback;
      const so = doc?.senderOriginal;
      log.debug(
        `[${label}][${i}] sender:${s ? typeof s : s} keys=${s ? Object.keys(s) : 'null'} | senderFallback:${sf ? typeof sf : sf} | senderOriginal:${so ? typeof so : so}`,
      );
    });
  }

  // ---------------- messages between two users for a given request ----------------

  async getMessages(params: any, me: User): Promise<PaginatedData> {
    console.log('[getMessages] start params=', params, ' me=', (me as any)?._id);
    try {
      const recipient = params['recipient']; // id or object
      const messageFor = params['messageFor']; // id or object
      const messageForModel = params['messageForModel'];
      const skip = parseInt(params.skip) || 0;

      if (!me || !recipient) {
        console.warn('[getMessages] missing me or recipient, returning empty');
        return { result: [], count: 0, skip };
      }

      const meId = this.toObjectId(me as any);
      const recId = this.toObjectId(recipient);
      const msgForId = this.toObjectId(messageFor);

      const chatFilter: FilterQuery<ChatDB> = {
        $or: [
          { sender: meId, receiver: recId },
          { sender: recId, receiver: meId },
        ],
        messageFor: msgForId,
        messageForModel,
      };

      console.log('[getMessages] filter=', chatFilter);
      const count = await this.chatModel.countDocuments(chatFilter);

      const chats = await this.chatModel
        .find(chatFilter)
        .populate({ path: 'sender', model: this.userModel.modelName })
        .populate({ path: 'receiver', model: this.userModel.modelName })
        .skip(skip)
        .limit(50)
        .sort({ createdAt: -1 })
        .lean();

      console.log('[getMessages] fetched len=', chats?.length);
      const result = chats.map((res) => new ChatDto(res as any));
      console.log('[getMessages] done count=', count, ' returned=', result?.length);
      return { result, count, skip };
    } catch (err) {
      console.error('[getMessages] ERROR=', err);
      throw err;
    }
  }

  // ---------------- inbox listing (latest per distinct sender) ----------------

 // chat.factory.ts
async getAllIncomingMessages(
  skip: number,
  query: any,
  me: { _id: string } | any,
): Promise<PaginatedData> {
  const log = new Logger('ChatFactory.getAllIncomingMessages');
  const t0 = Date.now();
  console.log('[getAllIncomingMessages] start skip=', skip, ' query=', query, ' me=', me?._id);

  // === local helpers (do NOT change response/request formats) =================
  const isObjectIdLike = (v: any) =>
    !!v &&
    (
      v instanceof Types.ObjectId ||
      (v as any)?._bsontype === 'ObjectID' ||
      typeof (v as any)?.toHexString === 'function' ||
      /^[a-f0-9]{24}$/i.test(String(v))
    );

  const toObjectIdSafe = (id: any): Types.ObjectId | null => {
    try {
      if (!id) return null;
      if (id instanceof Types.ObjectId) return id;
      if (isObjectIdLike(id)) return new Types.ObjectId(String(id));
      return null;
    } catch {
      return null;
    }
  };

  // Attach sender objects using multiple keys:
  // 1) senderId (if we have it), 2) messageFor.requesterOwner, 3) createdBy email,
  // 4) messageFor.createdBy email. Does NOT alter messageFor/request shape.
  const manualPopulateSenderLocal = async (rows: any[], logger: Logger) => {
    if (!rows?.length) return;

    // Normalize: add senderId where possible, but don't change payload shape
    for (const r of rows) {
      if (!r) continue;
      const s = r?.sender;
      (r as any).senderId =
        s && typeof s === 'object' && (s as any)?._id
          ? String((s as any)._id)
          : (isObjectIdLike(r?.sender) ? String(r.sender) : (r as any).senderId ?? null);
    }

    const needsAttach = rows.filter((r) => !r?.sender || typeof r.sender !== 'object');

    const candidateIds = new Set<string>();
    const emailCandidates = new Set<string>();

    for (const r of needsAttach) {
      // senderId
      if ((r as any).senderId) candidateIds.add(String((r as any).senderId));

      // requesterOwner (from messageFor) if present
      const mf = r?.messageFor;
      const requester = mf && typeof mf === 'object' ? (mf as any)?.requesterOwner : null;
      if (requester && isObjectIdLike(requester)) candidateIds.add(String(requester));

      // createdBy email (on chat)
      const createdBy = (r as any)?.createdBy;
      if (createdBy && /\S+@\S+\.\S+/.test(String(createdBy))) emailCandidates.add(String(createdBy).trim());

      // messageFor.createdBy email
      const mfCreatedBy = mf && typeof mf === 'object' ? (mf as any)?.createdBy : null;
      if (mfCreatedBy && /\S+@\S+\.\S+/.test(String(mfCreatedBy))) emailCandidates.add(String(mfCreatedBy).trim());
    }

    const uniqueIds = Array.from(candidateIds);
    const uniqueEmails = Array.from(emailCandidates);

    console.log(
      `[getAllIncomingMessages][hydrate] candidates=${needsAttach.length} | ids=${uniqueIds.length} | emails=${uniqueEmails.length} | ids=`,
      uniqueIds,
    );
    logger.debug(
      `[hydrate] candidates=${needsAttach.length} | ids=${uniqueIds.length} | emails=${uniqueEmails.length} | ids=${uniqueIds.join(',')}`,
    );

    // Batch fetch by ids
    let usersById: any[] = [];
    if (uniqueIds.length) {
      const idsObj = uniqueIds.map((id) => toObjectIdSafe(id)).filter(Boolean) as Types.ObjectId[];
      console.log('[getAllIncomingMessages][hydrate] idsObj=', idsObj);

      if (idsObj.length) {
        const tHyd = Date.now();
        usersById = await this.userModel
          .find({ _id: { $in: idsObj as any } } as any)
          .select('_id firstName lastName avatar email role id')
          .lean();
        console.log(
          `[getAllIncomingMessages][hydrate] usersById via ObjectId=${usersById.length} in ${Date.now() - tHyd}ms`,
        );
      }

      if (usersById.length === 0) {
        const tHyd2 = Date.now();
        usersById = await this.userModel
          .find({ _id: { $in: uniqueIds as any } } as any)
          .select('_id firstName lastName avatar email role id')
          .lean();
        console.warn(
          `[getAllIncomingMessages][hydrate][fallback] usersById via raw strings=${usersById.length} in ${Date.now() - tHyd2}ms`,
        );
      }
    }

    // Batch fetch by emails
    let usersByEmail: any[] = [];
    if (uniqueEmails.length) {
      const tEmail = Date.now();
      usersByEmail = await this.userModel
        .find({ email: { $in: uniqueEmails } } as any)
        .select('_id email firstName lastName avatar role id')
        .lean();
      console.log(`[getAllIncomingMessages][hydrate] usersByEmail=${usersByEmail.length} in ${Date.now() - tEmail}ms`);
    }

    const mapById = new Map<string, any>();
    for (const u of usersById) mapById.set(String((u as any)?._id), u);

    const mapByEmail = new Map<string, any>();
    for (const u of usersByEmail) {
      if ((u as any)?.email) mapByEmail.set(String((u as any).email).toLowerCase(), u);
    }

    let viaSenderId = 0;
    let viaRequester = 0;
    let viaEmail = 0;

    for (let i = 0; i < rows.length; i++) {
      const r: any = rows[i];
      if (r?.sender && typeof r.sender === 'object') continue;

      // 1) senderId
      const sid = r?.senderId;
      if (sid && mapById.has(String(sid))) {
        r.sender = mapById.get(String(sid));
        viaSenderId++;
        continue;
      }

      // 2) requesterOwner
      const mf = r?.messageFor;
      const requester = mf && typeof mf === 'object' ? (mf as any)?.requesterOwner : null;
      if (requester && mapById.has(String(requester))) {
        r.sender = mapById.get(String(requester));
        r.senderId = String(requester);
        viaRequester++;
        continue;
      }

      // 3) createdBy email (chat)
      const createdBy = r?.createdBy;
      if (createdBy && mapByEmail.has(String(createdBy).toLowerCase())) {
        const u = mapByEmail.get(String(createdBy).toLowerCase());
        r.sender = u;
        r.senderId = String((u as any)?._id);
        viaEmail++;
        continue;
      }

      // 4) messageFor.createdBy email
      const mfCreatedBy = mf && typeof mf === 'object' ? (mf as any)?.createdBy : null;
      if (mfCreatedBy && mapByEmail.has(String(mfCreatedBy).toLowerCase())) {
        const u = mapByEmail.get(String(mfCreatedBy).toLowerCase());
        r.sender = u;
        r.senderId = String((u as any)?._id);
        viaEmail++;
        continue;
      }
    }

    console.log(
      `[getAllIncomingMessages][attach] viaSenderId=${viaSenderId} | viaRequesterOwner=${viaRequester} | viaEmail=${viaEmail}`,
    );
    logger.debug(
      `[attach] viaSenderId=${viaSenderId} | viaRequesterOwner=${viaRequester} | viaEmail=${viaEmail}`,
    );
  };

  const debugFirstRowsLocal = async (rows: any[], logger: Logger, tag: string) => {
    (rows.slice(0, 5) || []).forEach((doc: any, i: number) => {
      const hasSenderObj = !!doc?.sender && typeof doc.sender === 'object';
      console.log(
        `[getAllIncomingMessages][${tag}] row[${i}] _id=${doc?._id} hasSender=${hasSenderObj} senderKeys=${
          hasSenderObj ? Object.keys(doc.sender) : 'null'
        }`,
      );
      logger.debug(
        `[${tag}] row[${i}] _id=${doc?._id} hasSender=${hasSenderObj} senderKeys=${
          hasSenderObj ? Object.keys(doc.sender) : 'null'
        }`,
      );
    });
  };
  // ===========================================================================

  try {
    const customerTypes: string[] | undefined = query.customerType
      ? String(query.customerType).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    log.debug(`[DBG] raw me._id=${String(me?._id)} (type=${typeof me?._id})`);

    const receiverObjectId = this.toObjectId(me?._id);
    log.debug(
      `[DBG] receiverObjectId=${String(receiverObjectId)} | isObjectIdLike=${this.isObjectIdLike(
        receiverObjectId,
      )}`,
    );

    // actual collection names
    const chatColl = this.chatModel.collection.collectionName;
    const userColl = this.userModel.collection.collectionName;
    const requestColl = this.requestModel.collection.collectionName;

    log.debug(`[DBG] collections | chat=${chatColl} | user=${userColl} | request=${requestColl}`);
    log.debug(
      `incoming params | skip=${skip} | customerTypes=${customerTypes?.join(',') ?? '(none)'} | receiver=${receiverObjectId}`,
    );

    let rows: any[] = [];
    let count = 0;
    let unreadCount = 0;

    if (customerTypes && customerTypes.length === 1) {
      // ----------------------- AGGREGATION BRANCH ---------------------------
      const secondFilter: any = {};
      if (customerTypes.includes('active')) {
        secondFilter.requestData = { $elemMatch: { hiredAffiliate: receiverObjectId } };
      }
      if (customerTypes.includes('potential')) {
        secondFilter.requestData = { $elemMatch: { hiredAffiliate: null } };
      }

      log.debug(`[DBG] secondFilter=${this.debugVal(secondFilter)}`);

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

        // Keep raw sender for logging + normalize
        {
          $addFields: {
            senderOriginal: '$sender',
            senderRawType: { $type: '$sender' },
          },
        },
        {
          $addFields: {
            senderObjId: {
              $switch: {
                branches: [
                  { case: { $eq: ['$senderRawType', 'objectId'] }, then: '$senderOriginal' },
                  {
                    case: {
                      $and: [
                        { $eq: ['$senderRawType', 'string'] },
                        { $regexMatch: { input: '$senderOriginal', regex: /^[a-f\d]{24}$/i } },
                      ],
                    },
                    then: { $toObjectId: '$senderOriginal' },
                  },
                ],
                default: null,
              },
            },
          },
        },

        // latest per sender
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$senderObjId', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },

        // lookup sender
        {
          $lookup: {
            from: userColl,
            localField: 'senderObjId',
            foreignField: '_id',
            as: 'senderData',
            pipeline: [{ $project: { firstName: 1, lastName: 1, avatar: 1, email: 1, role: 1, id: 1 } }],
          },
        },
        { $unwind: { path: '$senderData', preserveNullAndEmptyArrays: true } },

        // set final sender + fallback id for manual populate
        {
          $addFields: {
            sender: '$senderData',
            senderFallback: {
              $cond: [{ $ifNull: ['$senderData', false] }, null, '$senderObjId'],
            },
          },
        },
        { $project: { senderData: 0 } },

        // page
        { $sort: { createdAt: -1 } },
        { $skip: skip || 0 },
        { $limit: paginationLimit },
      ];

      log.debug(`[DBG] aggregation pipeline:\n${this.debugVal(pipeline)}`);

      rows = await this.chatModel.aggregate(pipeline);
      log.debug(`[DBG] rows.length after aggregate=${rows.length}`);
      console.log('[getAllIncomingMessages] aggregate rows len=', rows.length);

      await debugFirstRowsLocal(rows, log, 'agg');

      // counts (distinct senders)
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

      // normalize fields and drop temp props (keep request shape identical)
      rows = rows.map((doc: any) => {
        doc.messageFor = doc.requestData?.[0] || null;
        delete doc.requestData;
        return doc;
      });

      // Fallback/manual populate to guarantee sender object (matches your new output)
      await manualPopulateSenderLocal(rows, log);
      await debugFirstRowsLocal(rows, log, 'agg-post-fallback');
    } else {
      // ------------------------- SIMPLE BRANCH ------------------------------
      const chatFilter: FilterQuery<ChatDB> = { receiver: receiverObjectId };
      log.debug(`[DBG] simple branch chatFilter=${this.debugVal(chatFilter)}`);
      console.log('[getAllIncomingMessages] simple filter=', chatFilter);

      const countDocs = await this.chatModel.countDocuments(chatFilter);
      const unreadDocs = await this.chatModel.countDocuments({ ...chatFilter, read: null });
      count = countDocs;
      unreadCount = unreadDocs;

      log.debug(`[DBG] simple branch | count=${count} | unreadCount=${unreadCount}`);
      console.log('[getAllIncomingMessages] simple counts: count=', count, ' unread=', unreadCount);

      let rowsTmp: any[] = await this.chatModel
        .find(chatFilter)
        .select('+sender +receiver +messageFor +text +file +read +createdAt +updatedAt +createdBy')
        .populate({
          path: 'sender',
          model: this.userModel.modelName,
          select: 'firstName lastName avatar email role id',
          options: { lean: true },
        })
        .populate({ path: 'messageFor' })
        .skip(skip || 0)
        .limit(paginationLimit)
        .sort({ createdAt: -1 })
        .lean();

      rows = rowsTmp as any[];

      log.debug(`[DBG] simple branch rows.length=${rows.length}`);
      console.log('[getAllIncomingMessages] simple fetched rows len=', rows.length);

      // mark any non-populated sender for fallback
      (rows.slice(0, 5) || []).forEach((doc: any, i: number) => {
        const hasSenderObj = !!doc?.sender && typeof doc.sender === 'object';
        log.debug(`[DBG] simple sample[${i}] has sender populated object=${hasSenderObj}`);
        if (!hasSenderObj) (doc as any).senderFallback = doc.sender; // stash id for fallback
      });

      // Manual populate to guarantee sender object (matches your new output)
      await manualPopulateSenderLocal(rows, log);
      await debugFirstRowsLocal(rows, log, 'simple-post-fallback');
    }

    const nullSender = rows.filter((r: any) => !r?.sender).length;
    if (nullSender) {
      log.warn(`sanity | sender null count=${nullSender} / ${rows.length}`);
      log.warn(
        `examples=${this.debugVal(
          (rows.filter((c: any) => !c?.sender).slice(0, 3) || []).map((c: any) => ({
            _id: (c as any)?._id,
            senderRawType: (c as any)?.senderRawType,
            senderOriginal: (c as any)?.senderOriginal,
            senderObjId: (c as any)?.senderObjId,
            senderFallback: (c as any)?.senderFallback,
          })),
        )}`,
      );
    }

    const result = rows.map((r: any) => new IncomingChatDto(r as any));
    const t1 = Date.now();
    log.log(
      `success | results=${result.length} | count=${count} | unread=${unreadCount} | skip=${skip} | durationMs=${t1 - t0}`,
    );
    log.debug(`[DBG] final rows with null sender=${nullSender}/${rows.length}`);
    console.log('[getAllIncomingMessages] DONE results=', result.length, ' count=', count, ' unread=', unreadCount);

    return { result, count, unreadCount, skip };
  } catch (err) {
    const t1 = Date.now();
    const msg = (err as any)?.message || String(err);
    console.error('[getAllIncomingMessages] ERROR=', err);
    new Logger('ChatFactory.getAllIncomingMessages').error(
      `failed | durationMs=${t1 - t0} | error=${msg}`,
      (err as any)?.stack,
    );
    throw err;
  }
}


  async getAllIncomingMessages2(
    skip: number,
    query: any,
    me: { _id: string },
  ): Promise<PaginatedData> {
    const log = new Logger('ChatFactory.getAllIncomingMessages2');
    const t0 = Date.now();
    console.log('[getAllIncomingMessages2] start skip=', skip, ' query=', query, ' me=', me?._id);

    const receiverObjectId = this.toObjectId(me._id);
    const customerTypes: string[] = query.customerType?.split(',') ?? [];

    const isObjectIdLike = (v: any) =>
      !!v &&
      ((v as any)?._bsontype === 'ObjectID' ||
        typeof (v as any)?.toHexString === 'function' ||
        /^[a-f0-9]{24}$/i.test(String(v)));

    // ---- uses .where('_id').in([...]) to avoid TS overload issues ----
    const hydrateMissingSenders = async (rows: any[]) => {
      console.log('[getAllIncomingMessages2.hydrateMissingSenders] rows=', rows?.length);
      const withSenderId = rows.map((c: any) => {
        let senderId: string | null = null;
        if (c?.sender && typeof c.sender === 'object' && (c.sender as any)._id) {
          senderId = String((c.sender as any)._id);
        } else if ((c as any)?.senderId) {
          senderId = String((c as any).senderId);
        } else if (c?.sender) {
          senderId = isObjectIdLike(c.sender) ? String(c.sender) : null;
        } else if ((c as any)?.senderOriginal) {
          senderId = isObjectIdLike((c as any).senderOriginal) ? String((c as any).senderOriginal) : null;
        }
        return { ...(c as any), senderId };
      });

      const missing = withSenderId.filter((c: any) => !c.sender || typeof c.sender !== 'object');
      console.log(`[HYDRATE] rows=${withSenderId.length}, missingSenderObj=${missing.length}`);
      log.debug(`[HYDRATE] rows=${withSenderId.length}, missingSenderObj=${missing.length}`);

      const uniqueIds = Array.from(new Set(missing.map((c: any) => c.senderId!).filter(Boolean)));
      console.log(`[HYDRATE] unique sender ids to fetch:`, uniqueIds);
      log.debug(`[HYDRATE] unique sender ids to fetch: ${uniqueIds.join(',')}`);

      if (!uniqueIds.length) return withSenderId;

      // force ObjectIds
      const idsObj = uniqueIds
        .map((id: string) => this.toObjectIdSafe(id))
        .filter(Boolean) as Types.ObjectId[];

      const users = await this.userModel
        .find({ _id: { $in: idsObj as any } } as any)
        .select('_id firstName lastName avatar email role id')
        .lean();

      console.log(`[HYDRATE] fetched users=`, users.length, ' sample=', users.slice(0, 2));
      log.debug(`[HYDRATE] fetched users=${users.length}`);

      const userMap = new Map<string, any>();
      for (const u of users) userMap.set(String((u as any)._id), u);

      let attached = 0;
      const finalRows = withSenderId.map((c: any) => {
        if (!c.sender || typeof c.sender !== 'object') {
          if (c.senderId && userMap.has(c.senderId)) {
            attached++;
            return { ...c, sender: userMap.get(c.senderId) };
          }
        }
        return c;
      });

      console.log(`[HYDRATE] attached sender objects=`, attached);
      log.debug(`[HYDRATE] attached sender objects=${attached}`);
      return finalRows;
    };

    try {
      let chats: any[] = [];
      let count = 0;
      let unreadCount = 0;

      console.log(
        `>>> start | skip=${skip} | customerTypes=${customerTypes.join(',') || '(none)'} | receiver=${receiverObjectId}`,
      );
      log.debug(
        `start | skip=${skip} | customerTypes=${customerTypes.join(',') || '(none)'} | receiver=${receiverObjectId}`,
      );

      // SIMPLE branch
      const chatFilter: FilterQuery<ChatDB> = { receiver: receiverObjectId };
      console.log('>>> filter:', chatFilter);
      log.debug(`filter=${JSON.stringify(chatFilter)}`);

      count = await this.chatModel.countDocuments(chatFilter);
      unreadCount = await this.chatModel.countDocuments({ ...chatFilter, read: null });

      console.log(`>>> count=${count}, unreadCount=${unreadCount}`);
      log.debug(`count=${count}, unreadCount=${unreadCount}`);

      const tFind0 = Date.now();
      chats = await this.chatModel
        .find(chatFilter)
        .select('+sender +receiver +messageFor +text +file +read +createdAt +updatedAt')
        .populate({
          path: 'sender',
          select: 'firstName lastName avatar email role id',
          options: { lean: true },
        })
        .populate('messageFor')
        .skip(skip || 0)
        .limit(paginationLimit)
        .sort({ createdAt: -1 })
        .lean();

      console.log(`>>> fetched chats len=${chats.length}, ms=${Date.now() - tFind0}`);
      log.debug(`find ok | ms=${Date.now() - tFind0} | rows=${chats.length}`);

      chats = await hydrateMissingSenders(chats);

      chats.slice(0, 3).forEach((c: any, i: number) => {
        console.log(`[ROW ${i}] senderId=${c.senderId}, sender=`, c.sender);
        log.debug(`[ROW ${i}] senderId=${c.senderId}, senderKeys=${c.sender ? Object.keys(c.sender) : 'null'}`);
      });

      const result = chats.map((res: any) => new IncomingChatDto(res));

      console.log(
        `>>> DONE results=${result.length}, count=${count}, unread=${unreadCount}, totalMs=${Date.now() - t0}`,
      );
      log.log(
        `success | results=${result.length} | count=${count} | unread=${unreadCount} | durationMs=${Date.now() - t0}`,
      );

      return { result, count, unreadCount, skip };
    } catch (err) {
      console.error('>>> ERROR', err);
      log.error(`failed | error=${(err as any)?.message}`, (err as any)?.stack);
      throw err;
    }
  }

  // --------- NEW: Incoming Messages v3 (more robust sender inference + hydration) ----------
// chat.factory.ts (inside ChatFactory)
async getAllIncomingMessages3(
  skip: number,
  query: any,
  me: { _id: string },
): Promise<PaginatedData> {
  const log = new Logger('ChatFactory.getAllIncomingMessages3');
  const t0 = Date.now();

  // helpers
  const objId = this.toObjectId(me?._id);
  const customerTypes: string[] = query?.customerType?.split(',') ?? [];
  const safeSkip = Number.isFinite(skip) ? skip : 0;

  const isObjectIdLike = (v: any) =>
    !!v &&
    (
      v instanceof Types.ObjectId ||
      (v as any)?._bsontype === 'ObjectID' ||
      typeof (v as any)?.toHexString === 'function' ||
      /^[a-f0-9]{24}$/i.test(String(v))
    );

  console.log(
    `>>> [incoming3] start | skip=${safeSkip} | customerTypes=${customerTypes.join(',') || '(none)'} | receiver=${objId}`,
  );
  log.debug(
    `start | skip=${safeSkip} | customerTypes=${customerTypes.join(',') || '(none)'} | receiver=${objId}`,
  );

  // 1) Pull a page of messages for the receiver (simple & fast)
  const chatFilter: FilterQuery<ChatDB> = { receiver: objId };
  console.log('>>> [incoming3] filter:', chatFilter);
  log.debug(`filter=${this.debugVal(chatFilter)}`);

  const count = await this.chatModel.countDocuments(chatFilter);
  const unreadCount = await this.chatModel.countDocuments({ ...chatFilter, read: null });
  console.log(`>>> [incoming3] count=${count}, unreadCount=${unreadCount}`);
  log.debug(`count=${count}, unreadCount=${unreadCount}`);

  const tFind0 = Date.now();
  let rows: any[] = await this.chatModel
    .find(chatFilter)
    .select('+sender +receiver +messageFor +text +file +read +createdAt +updatedAt +createdBy')
    .populate({
      path: 'sender',
      select: '_id firstName lastName avatar email role id',
      options: { lean: true },
    })
    .populate('messageFor')
    .skip(safeSkip || 0)
    .limit(paginationLimit)
    .sort({ createdAt: -1 })
    .lean();

  console.log(`>>> [incoming3] fetched chats len=${rows.length}, ms=${Date.now() - tFind0}`);
  log.debug(`find ok | ms=${Date.now() - tFind0} | rows=${rows.length}`);

  // 2) Build an index to help infer missing senders (cast to any for TS)
  rows = rows.map((c: any) => {
    const s = c?.sender;
    return {
      ...c,
      senderOriginal: s,
      senderId:
        s && typeof s === 'object' && (s as any)?._id
          ? String((s as any)._id)
          : (isObjectIdLike(c?.sender) ? String(c.sender) : null),
    };
  });

  const missing = rows.filter((r: any) => !r.senderId);
  console.log(`[incoming3][infer] rows=${rows.length} | missing senderId=${missing.length}`);
  log.debug(`[infer] rows=${rows.length} | missing senderId=${missing.length}`);

  // Helper: try to infer a sender id for a single row
  const inferSenderIdForRow = async (row: any): Promise<string | null> => {
    // A) If we already have a sender object/id, done.
    if ((row as any)?.senderId) return (row as any).senderId;

    // B) Try to find another chat in same thread with a valid sender
    const mf = (row as any)?.messageFor;
    const mfId =
      mf && typeof mf === 'object' && (mf as any)?._id
        ? (mf as any)._id
        : mf;

    const threadFilter: any = {
      receiver: objId,
      messageFor: mfId,
      sender: { $ne: null },
    };
    if ((row as any)?.createdBy) threadFilter.createdBy = (row as any).createdBy;

    const t0i = Date.now();
    const neighbor: any = await this.chatModel
      .findOne(threadFilter)
      .select('_id sender createdBy')
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => null);

    log.debug(
      `[infer.one] row=${String((row as any)?._id)} | neighborLookupMs=${Date.now() - t0i} | found=${!!neighbor}`,
    );
    if (neighbor && isObjectIdLike(neighbor.sender)) {
      return String(neighbor.sender);
    }

    // C) If createdBy looks like an email, try to match a user
    if ((row as any)?.createdBy && /\S+@\S+\.\S+/.test(String((row as any).createdBy))) {
      const t1 = Date.now();
      const u: any = await this.userModel
        .findOne({ email: String((row as any).createdBy).trim() })
        .select('_id firstName lastName avatar email role id')
        .lean()
        .catch(() => null);
      log.debug(
        `[infer.email] row=${String((row as any)?._id)} | email=${(row as any)?.createdBy} | ms=${Date.now() - t1} | found=${!!u}`,
      );
      if (u?._id) return String(u._id);
    }

    return null;
  };

  // Infer senderIds for missing rows
  for (let i = 0; i < rows.length; i++) {
    if (!(rows[i] as any).senderId) {
      (rows[i] as any).senderId = await inferSenderIdForRow(rows[i]);
      console.log(`[incoming3][infer] row[${i}] _id=${(rows[i] as any)?._id} -> senderId=${(rows[i] as any).senderId}`);
      log.debug(`[infer] row[${i}] _id=${(rows[i] as any)?._id} -> senderId=${(rows[i] as any).senderId}`);
    }
  }

  // 3) MANUAL MAPPING: aggressively hydrate sender objects from users model
  // Collect ALL potential keys we can map to a user:
  //   - senderId (primary)
  //   - messageFor.requesterOwner (common link to user)
  //   - createdBy email (fallback)
  const needsAttach = rows.filter((r: any) => !r.sender || typeof r.sender !== 'object');

  const candidateIds = new Set<string>();
  const emailCandidates = new Set<string>();

  for (const r of needsAttach) {
    if ((r as any).senderId) candidateIds.add(String((r as any).senderId));
    const mf = (r as any)?.messageFor;
    const mfRequester = mf && typeof mf === 'object' ? (mf as any)?.requesterOwner : null;
    if (mfRequester && isObjectIdLike(mfRequester)) candidateIds.add(String(mfRequester));
    const createdBy = (r as any)?.createdBy;
    if (createdBy && /\S+@\S+\.\S+/.test(String(createdBy))) emailCandidates.add(String(createdBy).trim());
    // also consider messageFor.createdBy
    const mfCreatedBy = mf && typeof mf === 'object' ? (mf as any)?.createdBy : null;
    if (mfCreatedBy && /\S+@\S+\.\S+/.test(String(mfCreatedBy))) emailCandidates.add(String(mfCreatedBy).trim());
  }

  const uniqueIds = Array.from(candidateIds);
  const uniqueEmails = Array.from(emailCandidates);

  console.log(
    `[incoming3][hydrate] candidates=${needsAttach.length} | ids=${uniqueIds.length} | emails=${uniqueEmails.length} | ids=`,
    uniqueIds,
  );
  log.debug(
    `[hydrate] candidates=${needsAttach.length} | ids=${uniqueIds.length} | emails=${uniqueEmails.length} | ids=${uniqueIds.join(',')}`,
  );

  // Batch queries
  let usersById: any[] = [];
  let usersByEmail: any[] = [];

  if (uniqueIds.length) {
    // Try with strong ObjectId cast first
    const idsObj = uniqueIds
      .map((id) => this.toObjectIdSafe(id))
      .filter(Boolean) as Types.ObjectId[];

    console.log('[incoming3][hydrate] idsObj=', idsObj);
    const tHydIdsObj = Date.now();
    if (idsObj.length) {
      usersById = await this.userModel
        .find({ _id: { $in: idsObj as any } } as any)
        .select('_id firstName lastName avatar email role id')
        .lean();
    }
    console.log(
      `[incoming3][hydrate] usersById via ObjectId=${usersById.length} in ${Date.now() - tHydIdsObj}ms (idsObj len=${idsObj.length})`,
    );

    // If nothing, let Mongoose cast string ids
    if (usersById.length === 0) {
      const tHydIdsStr = Date.now();
      usersById = await this.userModel
        .find({ _id: { $in: uniqueIds as any } } as any)
        .select('_id firstName lastName avatar email role id')
        .lean();
      console.warn(
        `[incoming3][hydrate][fallback] usersById via raw strings=${usersById.length} in ${Date.now() - tHydIdsStr}ms`,
      );
    }
  }

  if (uniqueEmails.length) {
    const tHydEmail = Date.now();
    usersByEmail = await this.userModel
      .find({ email: { $in: uniqueEmails } } as any)
      .select('_id email firstName lastName avatar role id')
      .lean();
    console.log(
      `[incoming3][hydrate] usersByEmail=${usersByEmail.length} in ${Date.now() - tHydEmail}ms`,
    );
  }

  // Build maps
  const mapById = new Map<string, any>();
  for (const u of usersById) mapById.set(String((u as any)?._id), u);

  const mapByEmail = new Map<string, any>();
  for (const u of usersByEmail) {
    if ((u as any)?.email) mapByEmail.set(String((u as any).email).toLowerCase(), u);
  }

  // Attach users to rows using a clear precedence:
  //  1) senderId -> users._id
  //  2) messageFor.requesterOwner -> users._id
  //  3) createdBy email -> users.email
  //  4) messageFor.createdBy email -> users.email
  //  5) synthetic fallback
  let attached = 0;
  let attachedViaRequester = 0;
  let attachedViaEmail = 0;
  let synthetic = 0;

  rows = rows.map((r: any) => {
    if (r?.sender && typeof r.sender === 'object') return r; // already populated

    // (1) senderId
    const sid = (r as any).senderId;
    if (sid && mapById.has(String(sid))) {
      attached++;
      return { ...r, sender: mapById.get(String(sid)) };
    }

    // (2) requesterOwner
    const mf = (r as any)?.messageFor;
    const requester = mf && typeof mf === 'object' ? (mf as any)?.requesterOwner : null;
    if (requester && mapById.has(String(requester))) {
      attachedViaRequester++;
      return { ...r, sender: mapById.get(String(requester)), senderId: String(requester) };
    }

    // (3) createdBy email
    const createdBy = (r as any)?.createdBy;
    if (createdBy && mapByEmail.has(String(createdBy).toLowerCase())) {
      attachedViaEmail++;
      const u = mapByEmail.get(String(createdBy).toLowerCase());
      return { ...r, sender: u, senderId: String((u as any)?._id) };
    }

    // (4) messageFor.createdBy email
    const mfCreatedBy = mf && typeof mf === 'object' ? (mf as any)?.createdBy : null;
    if (mfCreatedBy && mapByEmail.has(String(mfCreatedBy).toLowerCase())) {
      attachedViaEmail++;
      const u = mapByEmail.get(String(mfCreatedBy).toLowerCase());
      return { ...r, sender: u, senderId: String((u as any)?._id) };
    }

    // (5) synthetic fallback so UI never gets null
    const fallbackEmail =
      (typeof createdBy === 'string' && createdBy) ||
      (mf && typeof mf === 'object' && (mf as any)?.createdBy) ||
      null;

    const fallbackId =
      sid ||
      (mf && typeof mf === 'object' && (mf as any)?.requesterOwner) ||
      null;

    const pseudo = {
      _id: fallbackId,
      firstName: 'Unknown',
      lastName: 'User',
      email: fallbackEmail,
      avatar: null,
      role: null,
      id: null,
      __synthetic: true,
    };

    synthetic++;
    return { ...r, sender: pseudo };
  });

  console.log(
    `[incoming3][attach] viaSenderId=${attached} | viaRequesterOwner=${attachedViaRequester} | viaEmail=${attachedViaEmail} | synthetic=${synthetic}`,
  );
  log.debug(
    `[attach] viaSenderId=${attached} | viaRequesterOwner=${attachedViaRequester} | viaEmail=${attachedViaEmail} | synthetic=${synthetic}`,
  );

  // Diagnostics: users collection probe
  try {
    const usersCountProbe = await this.userModel.estimatedDocumentCount();
    const oneUser = await this.userModel.findOne({}).select('_id email firstName lastName').lean();
    console.warn(
      '[incoming3][diag] users collection probe: count≈',
      usersCountProbe,
      ' sample _id=',
      oneUser?._id,
      ' email=',
      oneUser?.email,
    );
  } catch (probeErr) {
    console.warn('[incoming3][diag] users collection probe failed:', probeErr);
  }

  // 4) Log a few sample rows for sanity
  (rows.slice(0, 5) || []).forEach((doc: any, i: number) => {
    console.log(
      `[incoming3][ROW ${i}] _id=${(doc as any)?._id} senderId=${(doc as any)?.senderId} hasSenderObj=${
        !!doc?.sender && typeof doc.sender === 'object'
      } synthetic=${(doc as any)?.sender?.__synthetic ? 'yes' : 'no'}`,
    );
    log.debug(
      `[ROW ${i}] _id=${(doc as any)?._id} senderId=${(doc as any)?.senderId} senderKeys=${
        (doc as any)?.sender ? Object.keys((doc as any).sender) : 'null'
      } synthetic=${(doc as any)?.sender?.__synthetic ? 'yes' : 'no'}`,
    );
  });

  // 5) Return the same shape as existing endpoints (IncomingChatDto + counts)
  const result = rows.map((res: any) => new IncomingChatDto(res));
  console.log(
    `>>> [incoming3] DONE results=${result.length}, count=${count}, unread=${unreadCount}, totalMs=${Date.now() - t0}`,
  );
  log.log(
    `success | results=${result.length} | count=${count} | unread=${unreadCount} | durationMs=${Date.now() - t0}`,
  );

  return { result, count, unreadCount, skip };
}


  // ---------------- create message ----------------

  async newMessage(data: Chat): Promise<Chat> {
    console.log('[newMessage] start data keys=', Object.keys(data || {}));
    try {
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

      if (typeof res.populate === 'function') {
        res = await (res as any)
          .populate('receiver')
          .populate('sender')
          .populate('messageFor')
          .execPopulate?.();
      }

      const message = new ChatDto(res);
      console.log('[newMessage] saved chat id=', (message as any)?.id);

      if (message) {
        await this.notificationfactory.sendNotification(
          (message as any).receiver,
          NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          {
            inApp: {
              message: {
                requestId: (message as any).messageFor?.id,
                title: `New Message from ${getfullName((message as any).sender)}`,
                description: (message as any).text,
                chatGroup: {
                  messageFor: (message as any).messageFor,
                  messageForModel: (message as any).messageForModel,
                  recipient: (message as any).sender,
                },
                type: NOTIFICATION_MESSAGE_TYPE.CHAT_MESSAGE,
              },
            },
          },
        );
        console.log('[newMessage] notification queued');
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
          console.log('[newMessage] mail queued to=', (message as any).receiver?.email);
        } catch (mailErr) {
          console.warn('[newMessage] mail send failed (ignored):', mailErr);
        }
      }

      console.log('[newMessage] done chat id=', (message as any)?.id);
      return message;
    } catch (err) {
      console.error('[newMessage] ERROR=', err);
      throw err;
    }
  }

  // ---------------- mark messages as read ----------------

  async readAllMessages(message: Chat): Promise<boolean> {
    console.log('[readAllMessages] start for receiver=', (message as any)?.receiver, ' sender=', (message as any)?.sender);
    try {
      const condition: FilterQuery<ChatDB> = {
        receiver: this.toObjectId((message as any).receiver),
        sender: this.toObjectId((message as any).sender),
        messageFor: this.toObjectId((message as any).messageFor),
        messageForModel: (message as any).messageForModel,
        read: null,
      };

      const data = { read: new Date() };
      const newValue = { $set: data };

      const upd: any = await this.chatModel.updateMany(condition, newValue);
      const modified =
        (typeof upd?.modifiedCount === 'number' && upd.modifiedCount) ||
        (typeof upd?.nModified === 'number' && upd.nModified) ||
        0;

      console.log('[readAllMessages] updated=', modified);

      await this.notificationfactory.readUserNotifications(
        (message as any).receiver,
        {
          'message.requestId': (message as any).requestId,
          'message.type': NOTIFICATION_MESSAGE_TYPE.CHAT_MESSAGE,
        },
      );
      console.log('[readAllMessages] notifications marked read');
      return true;
    } catch (e) {
      console.error('[readAllMessages] ERROR=', e);
      return false;
    }
  }
}
