import * as mongoose from 'mongoose';

export const businessProfileSchema = new mongoose.Schema(
  {
    businessImage: { type: String, default: null },
    businessVideo: { type: String },
    businessName: { type: String, default: '' },
    bio: { type: String, default: '' },
    foundingDate: { type: Date, required: true },
    services: [
      {
        type: String,
        enum: [
          ' ',
          'REMOVE',
          'MOVE',
          'PRESSURE_WASH',
          'REALTOR',
          'GARAGE',
          'OTHER',
        ],
      },
    ],
    questionAnswers: [
      {
        question: { type: String },
        answer: { type: String },
      },
    ],
    rating: { type: Number, default: 0 }, // unweighted running average
    ratingCount: { type: Number, default: 0 },
    serviceCoverageRadius: { type: Number, require: true, default: null }, // in miles
    areaServices: [
      {
        zipCode: { type: String, required: true },
        lat: { type: Number },
        lng: { type: Number },
      },
    ], // affiliate primary zipcodes
    nearByZipCodes: [{ type: String }], // affiliate near by zipcodes from primary zipcodes, note: also includes primary zipcodes
    termsAccepted: { type: Boolean, default: false, select: false },
    isApproved: { type: Boolean, default: false },
    approvedDate: { type: Date },
    allowMinimumPricing: { type: Boolean, default: false },
    sellingItemsInfo: { type: String },
    // sellingItemCharge: {
    //     chargeBasis: { type: String, enum: ['COMMISSION', 'FLAT_FEE'], default: 'COMMISSION' },
    //     fee: { type: Number }
    // }
  },
  {
    timestamps: true,
  },
);
