import mongoose from 'mongoose';

export const appointmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // 1000 , 10001
    title: { type: String },
    notes: { type: String },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    appointee: { type: mongoose.Types.ObjectId, ref: 'users' },
    appointer: { type: mongoose.Types.ObjectId, ref: 'users' },
    appointmentFor: {
      type: mongoose.Types.ObjectId,
      required: true,
      // Instead of a hardcoded model name in `ref`, `refPath` means Mongoose
      // will look at the `forModel` property to find the right model.
      refPath: 'appointmentForModel',
    },
    appointmentForModel: {
      type: String,
      required: true,
      enum: ['request'],
    },
    rescheduleRequested: { type: Boolean },
    setOnAppointeeDevice: { type: Boolean },
    setOnAppointerDevice: { type: Boolean },
    notify: { type: Boolean },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, require: true },
    updatedBy: { type: String, require: true, default: null },
  },
  {
    timestamps: true,
  },
);
