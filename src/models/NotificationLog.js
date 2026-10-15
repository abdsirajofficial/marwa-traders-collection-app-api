import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ['CUSTOMER', 'OWNER'],
      required: true,
      index: true,
    },
    recipientNumber: {
      type: String,
      required: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['PAYMENT_RECEIPT', 'COLLECTION_ALERT'],
      required: true,
    },
    messageBody: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
