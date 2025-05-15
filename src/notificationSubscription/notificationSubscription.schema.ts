import * as mongoose from 'mongoose';
import { USER_ROLES } from 'src/config';

export const notificationSubscriptionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true, unique: true },
  desc: { type: String },
  notificationChannels: [{ type: String, enum: ['SMS', 'EMAIL'] }],   // ignore for now
  forRoles: [
    { type: Number, enum: Object.values(USER_ROLES) }
  ],
  isActive: { type: Boolean, default: true },
})