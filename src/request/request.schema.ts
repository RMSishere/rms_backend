import * as mongoose from 'mongoose';
import { REQUEST_STATUS, CHARGE_BASIS } from '../config';
import { requestAgreementSchema } from './requestAgreement.schema';

export const requestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // 1000 , 10001

    zip: { type: String, required: true },
    deliveryTime: {
      type: String,
      enum: [
        'IMMEDIATELY',
        'VERY_SOON',
        'PRETTY_SOON',
        'SOMETIME_LATER_ON',
        'SOON',
        'IN_THE_NEAR_FUTURE',
      ],
      required: true,
    },
    ghlOpportunityId: { type: String, default: null },
    whereToSell: { type: String, default: null },
    noOfItems: { type: String, default: null },
    typeOfItems: [
      {
        name: { type: String },
      },
    ],

    items: [
      {
        name: { type: String },
        typeOfItem: { type: String },
        itemQuality: {
          type: String,
          enum: [
            'BRAND_NEW',
            'LIKE_NEW',
            'VERY_GOOD',
            'GOOD',
            'OKAY',
            'ROUGH_CONDITION',
          ],
        },
        status: {
          type: String,
          enum: ['SOLD', 'LISTED_BUT_NOT_SOLD', 'NOT_LISTED_YET'],
          default: 'NOT_LISTED_YET',
        },
        remark: { type: String }, // [Report] applicable for Sell , remove
        images: [{ type: String }], // [Report] images path of items that has been SOLD | LISTED_BUT_NOT_SOLD | NOT_LISTED_YET
        videos: [{ type: String }], // [Report] videos path of items that has been SOLD | LISTED_BUT_NOT_SOLD | NOT_LISTED_YET
        noOfItems: { type: Number, default: 1 },
        minimumPrice: { type: Number }, // only applies to SELL
        amount: { type: Number }, // [Report] Amount Item Sold For 1000$
        affiliateCommissionCharge: { type: Number }, // in percent
        affiliateFlatFeeCharge: { type: Number },
        pickupDate: { type: Date, default: null }, // [Report] if null means not yet pickup , else will have a date .
        pickupLocation: { type: String }, // [Report] Move: pick from
        dropLocation: { type: String }, // [Report] MOve : drop , Garage Organizing : where items were organized
        saleLocation: { type: String }, // [Report] MOve : drop , Garage Organizing : where items were organized
        listedLocation: { type: String }, // [Report] MOve : drop , Garage Organizing : where items were organized
        jobDate: { type: Date }, // [Report]
      },
    ],

    realtorConnectedWith: { type: String }, // [Report]
    affiliateNotes: { type: String }, // [Report] applicable for Sell , remove , move , Garage Organizing , pressure washing

    jobDate: { type: Date, default: null }, // job assigned date or affiliate hiring date
    endDate: { type: Date, default: null }, // job completion/close data

    itemsSizes: [
      {
        size: { type: String, enum: ['SMALL', 'MEDIUM', 'LARGE'] },
        percent: {
          type: String,
          enum: ['0 to 10%', '25%', '50%', '75%', '100%'],
        },
      },
    ],
    itemQualities: [
      {
        qualityType: {
          type: String,
          enum: [
            'BRAND_NEW',
            'LIKE_NEW',
            'VERY_GOOD',
            'GOOD',
            'OKAY',
            'ROUGH_CONDITION',
          ],
        },
        qualityPercent: {
          type: String,
          enum: ['0 to 10%', '25%', '50%', '75%', '100%'],
        },
      },
    ],
    itemlocation: [
      {
        location: {
          type: String,
          default: null,
        },
        zones: [
          {
            type: String,
            default: null,
          },
        ],
      },
    ],
    isFinalized: { type: Boolean, default: false }, // for sale
    itemsWeight: { type: String },
    needRealtor: { type: String },
    pressureWashItems: { type: Array, default: null },
    state: { type: String, default: null },
    whatHelpNeed: { type: String, default: '' },
    city: { type: String, default: null },
    movingFrom: [{ type: String, default: null }],
    movingFromFloor: { type: Number, default: null },
    movingTo: [{ type: String, default: null }],
    movingToFloor: { type: Number, default: null },
    extraItem: { type: String, default: null },
    organized: { type: Array, default: null },
    images: { type: Array, require: true, default: [] },
    videos: { type: Array, require: true, default: [] },
    remark: { type: String, require: true, default: null },
    price: { type: Number, required: true },
    status: {
      type: String,
      require: true,
      enum: Object.keys(REQUEST_STATUS),
      default: REQUEST_STATUS.INIT,
    },
    requestType: {
      type: String,
      required: true,
      enum: [
        'SELL',
        'REMOVE',
        'MOVE',
        'PRESSURE_WASH',
        'REALTOR',
        'GARAGE',
        'OTHER',
      ],
    },
    leads: [
      {
        affiliate: { type: mongoose.Types.ObjectId, ref: 'users' },
        requestedAt: { type: Date },
        updatedAt: { type: Date, default: null },
        agreement: {
          type: requestAgreementSchema,
          default: null,
        },
      },
    ],
    requesterOwner: { type: mongoose.Types.ObjectId, ref: 'users' },
    hiredAffiliate: {
      type: mongoose.Types.ObjectId,
      ref: 'users',
      default: null,
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, require: true },
    updatedBy: { type: String, require: true, default: null },
    jobUpdates: [
      {
        title: { type: String },
        notes: { type: String },
        type: { type: String },
        appointment: { type: mongoose.Types.ObjectId, ref: 'Appointment' },
        createdAt: { type: Date, required: true },
      },
    ],
  },
  {
    timestamps: true,
    excludeIndexes: true,
  },
);

const autoPopulate = function(next) {
  this.populate('requesterOwner')
    .populate('hiredAffiliate')
    .populate('leads.affiliate')
    .populate('jobUpdates.appointment');
  next();
};

requestSchema
  .pre('findOneAndUpdate', autoPopulate)
  .pre('findOne', autoPopulate);
