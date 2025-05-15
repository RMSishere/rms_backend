import * as mongoose from 'mongoose';
import { USER_ROLES } from 'src/config';

export const notificationSubscriptionSchema = new mongoose.Schema({
  id: { type: String, required: false, default: null },
  title: { type: String, required: false, default: null },
  desc: { type: String, default: null },
  notificationChannels: {
    type: [{ type: String, enum: ['SMS', 'EMAIL'] }],
    default: undefined,
  },
  forRoles: {
    type: [{ type: Number, enum: Object.values(USER_ROLES) }],
    default: undefined,
  },
  isActive: { type: Boolean, default: true },
});
