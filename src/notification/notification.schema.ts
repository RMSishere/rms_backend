import * as mongoose from 'mongoose';
import { usersSchema } from 'src/users/users.schema';
import { requestSchema } from 'src/request/request.schema';

export const notificationSchema = new mongoose.Schema(
  {
    // id: { type: String, required: true, unique: true },
    recipient: { type: mongoose.Types.ObjectId, ref: 'users' },
    message: {
      title: String,
      description: String,
      requestId: String,
      chatGroup: {
        messageFor: requestSchema,
        messageForModel: String,
        recipient: usersSchema,
      },
      screen: String,
      screenParams: Object,
      type: { type: String },
    },
    type: { type: String, require: true, default: null },
    read: { type: Date, default: null },
    createdBy: { type: String, require: true },
    updatedBy: { type: String, require: true, default: null },
  },
  {
    timestamps: true,
  },
);
