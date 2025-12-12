import mongoose from 'mongoose';

export const helpMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  user: {
    type: mongoose.Types.ObjectId,
    ref: 'users',
    required: true,
  },
  message: { type: String, required: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, require: true, default: null },
}, {
  timestamps: true
});