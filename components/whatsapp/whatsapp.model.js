import mongoose from 'mongoose';
import { NOTIFICATION_STATUS } from '../../common/utils/constants.js';

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
    referenceId: {
      type: String, // Receipt number or workSessionId
      required: true,
      index: true,
    },
    templateName: {
      type: String,
      required: true,
    },
    messageBody: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.PENDING,
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
