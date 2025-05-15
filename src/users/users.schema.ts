import * as mongoose from 'mongoose';
import { notificationSubscriptionSchema } from '../notificationSubscription/notificationSubscription.schema';
import { businessProfileSchema } from './businessProfile.schema';
import { USER_ROLES } from 'src/config';

export const usersSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: '' },
    avatar: { type: String },
    dob: { type: Date },
    email: { type: String, trim: true,  sparse: true },
    phoneNumber: { type: String, trim: true,  sparse: true },
    password: { type: String, default: null }, // TODO: make select: false
    zipCode: { type: String },
    role: { type: Number, default: USER_ROLES.CLIENT },
    businessProfile: businessProfileSchema,
    isMobileVerfied: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    addedMiscInfo: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    countryCode: { type: String, default: '' },
    callingCode: { type: String, default: '' },
    isSocialLogin: { type: Boolean, default: false },
    facebookProvider: {
      type: {
        id: String,
        token: String,
      },
      // select: false,
    },
    appleProvider: {
      type: {
          id: String,
          token: String,
      },
      // select: false,
    },
    wordpressProvider: {
      type: {
        id: String,
        token: String,
      },
    },
    devices: [
      {
        token: { type: String },
        os: { type: String },
      },
    ],
    notificationSubscriptions: {
      type: [notificationSubscriptionSchema],
      default: undefined, // makes the field optional
    },
        receiveMailForChat: { type: Boolean, default: false },
    termsAccepted: { type: Boolean, default: false, select: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    blockedUsers: [{ type: mongoose.Types.ObjectId, ref: 'users' }],
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);
