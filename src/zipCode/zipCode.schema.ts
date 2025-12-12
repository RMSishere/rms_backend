import mongoose from 'mongoose';

export const zipCodeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  zipCode: { type: String, required: true, unique: true },
  leadCalculations: [{
    minCount: { type: Number, required: true },
    maxCount: { type: Number, required: true },
    price: { type: Number, required: true },
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, require: true },
  updatedBy: { type: String, require: true, default: null },
}, {
  timestamps: true
});