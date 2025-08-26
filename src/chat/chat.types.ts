// src/chat/chat.types.ts
import { Types } from 'mongoose';

export type ObjectId = Types.ObjectId;

export interface ChatDB {
  sender: ObjectId;                 // ref -> users
  receiver: ObjectId;               // ref -> users
  text?: string;
  file?: { url: string; mime: string };
  messageFor: ObjectId;             // refPath target _id
  messageForModel: 'request';
  read?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  id: string;                       // your sequential id
}
