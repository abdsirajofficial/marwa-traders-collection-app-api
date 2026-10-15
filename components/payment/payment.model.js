import mongoose from 'mongoose';
import { PAYMENT_STATUS } from '../../common/utils/constants.js';

const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    workSessionId: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    previousOutstanding: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingOutstanding: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMode: {
      type: String,
      enum: ['CASH', 'GPAY'],
      default: 'CASH',
      required: true,
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    location: {
      locationName: { type: String, default: null },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      address: { type: String, default: null },
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.COMPLETED,
      index: true,
    },
    allocations: [
      {
        invoiceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Invoice',
          required: true,
        },
        amountAllocated: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },
    settled: {
      type: Boolean,
      default: false,
      index: true,
    },
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Settlement',
      default: null,
    },
    reversalReason: {
      type: String,
      default: null,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reversedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ collectedBy: 1, workSessionId: 1 });
paymentSchema.index({ collectedBy: 1, createdAt: 1 });
paymentSchema.index({ customerId: 1, createdAt: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
