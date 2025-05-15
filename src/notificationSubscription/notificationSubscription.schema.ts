import * as mongoose from 'mongoose';
import { USER_ROLES } from 'src/config';

export const notificationSubscriptionSchema = new mongoose.Schema({
  id: { type: String, default: null, index: false }, // explicitly disable index
  title: { type: String, default: null },
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
}, { _id: false }); // IMPORTANT: Prevents creation of subdocument _id fields
