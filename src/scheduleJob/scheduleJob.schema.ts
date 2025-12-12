import mongoose from 'mongoose';
import { SCHEDULE_JOB_TYPES } from 'src/config';

export const scheduleJobSchema = new mongoose.Schema(
  {
    jobType: { type: String, enum: SCHEDULE_JOB_TYPES },
    jobDate: { type: Date, required: true },
    jobData: { type: Object },
    jobFor: {
      type: mongoose.Types.ObjectId,
      required: true,
      // Instead of a hardcoded model name in `ref`, `refPath` means Mongoose
      // will look at the `forModel` property to find the right model.
      refPath: 'jobForModel',
    },
    jobForModel: {
      type: String,
      required: true,
      enum: ['appointment'],
    },
    completed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);
