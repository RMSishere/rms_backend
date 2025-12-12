import mongoose from 'mongoose';

export const chatSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    sender: { type: mongoose.Types.ObjectId, ref: 'users' },
    receiver: { type: mongoose.Types.ObjectId, ref: 'users' },
    text: { type: String },
    file: {
      url: { type: String, default: '' },
      mime: { type: String, default: '' },
    },
    messageFor: {
      type: mongoose.Types.ObjectId,
      required: true,
      // Instead of a hardcoded model name in `ref`, `refPath` means Mongoose
      // will look at the `forModel` property to find the right model.
      refPath: 'messageForModel',
    },
    messageForModel: {
      type: String,
      required: true,
      enum: ['request'],
    },
    read: { type: Date, default: null },
    createdBy: { type: String, require: true, default: null },
    updatedBy: { type: String, require: true, default: null },
  },
  {
    timestamps: true,
  },
);
