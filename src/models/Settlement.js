import mongoose from 'mongoose';

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
      enum: ['SETTLED', 'SHORTAGE', 'PARTIALLY_SETTLED'],
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
