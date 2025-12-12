import mongoose from 'mongoose';

export const userMiscInfoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    user: { type: mongoose.Types.ObjectId, ref: 'users' },
    name: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    zipCode: { type: String },
    homePhoneNumber: { type: String },
    cellPhoneNumber: { type: String },
    email: { type: String },
    facebookProfile: { type: String },
    instagramProfile: { type: String },
    twiiterProfile: { type: String },
    linkedinProfile: { type: String },
    gender: { type: String, enum: ['MALE', 'FEMALE'] },
    isMarried: { type: Boolean },
    gainingMoneyForOrgainization: { type: Boolean },
    isWidow: { type: Boolean },
    isMoving: { type: Boolean },
    isMovingIntoRetirementHome: { type: Boolean },
    isDownsizing: { type: Boolean },
    howDidYouFindUs: { type: String },
    howDidYouFindUsDesc: { type: String },
    ageGroup: { type: String },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);
