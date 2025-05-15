import * as mongoose from 'mongoose';

export const jobReviewSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  customer: {
    type: mongoose.Types.ObjectId,
    ref: 'users',
    required: true,
  },
  affiliate: {
    type: mongoose.Types.ObjectId,
    ref: 'users',
    required: true,
  },
  request: { type: mongoose.Types.ObjectId, ref: 'request', required: true },
  name: { type: String, default: '' },
  professionalism: { type: Number },
  qualityOfAreaPressureWashed: { type: Number },
  handlingOfItemsSafely: { type: Number },
  timeliness: { type: Number },
  locationCleanliness: { type: Number },
  amountMade: { type: Number },
  advertising: { type: Number },
  totalSatisfaction: { type: Number },
  communication: { type: Number },
  overAllRating: { type: Number, default: 0 },
  comments: { type: String, default: '' },
  allowtestimonial: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, require: true, default: null },
}, {
  timestamps: true
});