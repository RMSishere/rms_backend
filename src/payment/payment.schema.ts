import * as mongoose from 'mongoose';
import { requestSchema } from 'src/request/request.schema';
import { PAYMENT_TYPES } from '../config'

// const embeddedRequestSchema = requestSchema.clone().removeIndexes();

export const paymentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },       // will server as transaction id
    amount: { type: Number, required: true },
    payee: { type: mongoose.Types.ObjectId, ref: "users" },
    // request: { type: mongoose.Types.ObjectId, ref: "request" },
    request: requestSchema,
    paymentForModel: {
        type: String,
        required: true,
        enum: ['request']
    },
    type: { type: String, required: true, enum: Object.values(PAYMENT_TYPES) },    
    currencyCode: { type: String, required: true },
    orderId: { type: String, required: true },
    captureId: { type: String, default: null },
    status: { type: String, required: true },
    transactionStatus: { type: String },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: null },
}, {
    timestamps: true
});