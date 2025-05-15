import * as mongoose from 'mongoose';

export const zipCodeSearchSchema = new mongoose.Schema(
  {
    zipCode: { type: String, required: true, unique: true },
    searchCount: { type: Number, default: 0 },
    affiliatesCount: { type: Number, default: 0 },
    users: [{ type: mongoose.Types.ObjectId, ref: 'users', default: [] }],
  },
  {
    timestamps: true,
  },
);
