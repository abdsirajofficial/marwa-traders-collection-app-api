import mongoose from 'mongoose';
import { SETTLEMENT_STATUS, CORRECTION_STATUS } from '../../common/utils/constants.js';

const settlementSchema = new mongoose.Schema(
  {
    settlementNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    settlementDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    expectedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    receivedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    difference: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SETTLEMENT_STATUS),
      required: true,
      index: true,
    },
    paymentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    settledAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const Settlement = mongoose.model('Settlement', settlementSchema);

const paymentCorrectionSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalAmount: {
      type: Number,
      required: true,
    },
    requestedAmount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(CORRECTION_STATUS),
      default: CORRECTION_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNotes: {
      type: String,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PaymentCorrection = mongoose.model('PaymentCorrection', paymentCorrectionSchema);
