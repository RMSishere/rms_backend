import mongoose from 'mongoose';
import { CHARGE_BASIS } from 'src/config';

// Sub-schema for paymentWay
const paymentWaySchema = new mongoose.Schema(
  {
    type: { type: String, default: 'FULL' }, // 'DEPOSIT' | 'FULL' | others
    name: { type: String },
    note: { type: String },

    // Legacy single-amount (FULL)
    amount: { type: Number },

    // Deposit flow
    deposit: { type: Number },
    completion: { type: Number },

    // NEW: percent flag (true => deposit/completion are percentages)
    percent: { type: Boolean, default: false },
  },
  { _id: false }
);

// Validate when DEPOSIT
paymentWaySchema.pre('validate', function (next) {
  const pw: any = this;

  if (pw.type === 'DEPOSIT') {
    const isNum = (v: any) => typeof v === 'number' && !Number.isNaN(v);

    if (!isNum(pw.deposit)) {
      return next(new Error('paymentWay.deposit must be a number for type DEPOSIT'));
    }
    if (!isNum(pw.completion)) {
      return next(new Error('paymentWay.completion must be a number for type DEPOSIT'));
    }

    // If using percent, ensure reasonable bounds
    if (pw.percent === true) {
      if (pw.deposit < 0 || pw.deposit > 100) {
        return next(new Error('paymentWay.deposit must be between 0 and 100 when percent is true'));
      }
      if (pw.completion < 0 || pw.completion > 100) {
        return next(new Error('paymentWay.completion must be between 0 and 100 when percent is true'));
      }
      // Optional strict rule:
      // if (pw.deposit + pw.completion !== 100) {
      //   return next(new Error('When percent=true, deposit + completion must equal 100'));
      // }
    }
  }

  next();
});

export const requestAgreementSchema = new mongoose.Schema(
  {
    meetingDates: [{ date: Date, note: String }],
    saleCatalogDates: [{ date: Date }],
    offlineSaleDates: [{ date: Date }],
    onlineSaleDates: [{ date: Date }],
    itemRemovalDates: [{ date: Date }],
    itemAdvertisingLocations: [{ locationName: String, note: String }],
    infoUpdateMethods: [{ name: String, note: String }],
    infoUpdateTime: { name: String, note: String },
    minPriceAllowance: { name: String, note: String },
    itemStoreLocations: [{ locationName: String, note: String }],
    itemSaleLocations: [{ locationName: String, note: String }],
    cataloggingParty: { name: String, note: String },
    cataloggingDetails: { name: String, note: String },
    suppliesBrought: { type: String },
    notesForNotSellableItems: { name: String, note: String },
    notesForDeemedNotSellableItems: { name: String, note: String },
    additionalDealNotes: { type: String },
    additionalNotes: { type: String },
    jobDateTime: { type: Date },
    itemsPickupLocations: [{ locationName: String }],
    itemsDeliveryLocations: [{ locationName: String }],
    itemBroughtLocation: { name: String, note: String },
    itemsServiced: { type: String },
    insuranceNotes: { type: String },
    numberOfMovers: { type: Number },
    jobLocation: { type: String },

    itemServiceAreas: [{ name: String, note: String }],

    // supports FULL and DEPOSIT with 'percent'
    paymentWay: paymentWaySchema,

    additionalPaymentTermsNotes: String,

    jobFeeChargeMethods: [
      {
        type: {
          type: String,
          enum: Object.keys(CHARGE_BASIS),
          default: CHARGE_BASIS.FLAT_FEE,
        },
        isSlidingScale: Boolean,
        feeRange: [
          {
            from: Number,
            to: Number,
            charge: Number,
            chargeBasis: {
              type: String,
              enum: Object.keys(CHARGE_BASIS),
              default: CHARGE_BASIS.FLAT_FEE,
            },
          },
        ],
      },
    ],
    perItemChargeMethods: [
      {
        type: {
          type: String,
          enum: Object.keys(CHARGE_BASIS),
          default: CHARGE_BASIS.FLAT_FEE,
        },
        isSlidingScale: Boolean,
        feeRange: [
          {
            from: Number,
            to: Number,
            charge: Number,
            chargeBasis: {
              type: String,
              enum: Object.keys(CHARGE_BASIS),
              default: CHARGE_BASIS.FLAT_FEE,
            },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);
