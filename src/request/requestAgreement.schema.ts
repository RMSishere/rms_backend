import * as mongoose from 'mongoose';
import { CHARGE_BASIS } from 'src/config';

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
    paymentWay: { name: String, note: String, amount: Number },
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
  {
    timestamps: true,
  },
);
