import axios from 'axios';
import { config } from '../../common/config/index.js';
import { NotificationLog } from './whatsapp.model.js';
import {
  buildCustomerPaymentReceiptMessage,
  buildOwnerDailyReportMessage,
} from './whatsapp.helper.js';
import { logAuditEvent } from '../audit-log/audit-log.service.js';
import { addJob } from '../../common/service/queue.service.js';
import { NOTIFICATION_STATUS, WHATSAPP_TEMPLATES, AUDIT_ACTIONS } from '../../common/utils/constants.js';

/**
 * Format recipient number with country code (defaults to 91 for India if 10 digits)
 */
export function formatWhatsAppNumber(recipientNumber) {
  if (!recipientNumber) return '';
  let cleaned = String(recipientNumber).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `91${cleaned.substring(1)}`;
  }
  return cleaned;
}

/**
 * Low-level HTTP dispatch to WhatsApp Cloud API / provider
 */
async function sendWhatsAppHttp(recipientNumber, messageBody) {
  const formattedNumber = formatWhatsAppNumber(recipientNumber);

  if (config.whatsapp.accessToken && config.whatsapp.phoneNumberId) {
    const url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`;
    console.log(`[WhatsAppService] Dispatching WhatsApp message to ${formattedNumber} (${url})...`);
    return axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'text',
        text: { body: messageBody },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  }

  // Simulated provider mode (Dev/Test)
  console.log(`[WhatsApp Provider] Sending to ${formattedNumber}:\n${messageBody}\n----------------------------------`);
  return { status: 200, data: { messages: [{ id: `wamid.mock.${Date.now()}` }] } };
}

async function processDirectDispatch(jobData) {
  const { logId, recipientNumber, messageBody, referenceId, recipientType } = jobData;
  try {
    const res = await sendWhatsAppHttp(recipientNumber, messageBody);
    await NotificationLog.findByIdAndUpdate(logId, { status: NOTIFICATION_STATUS.SENT });
    console.log(`[WhatsAppService] Delivery SUCCESSFUL to ${recipientNumber} for ref: ${referenceId}`);
    await logAuditEvent({
      role: 'SYSTEM',
      action: AUDIT_ACTIONS.NOTIFICATION_SENT,
      entity: 'NOTIFICATION',
      entityId: logId,
      description: `WhatsApp ${recipientType} notification sent for ref: ${referenceId}`,
    });
  } catch (error) {
    const errorDetails = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;

    console.error(`[WhatsAppService] Delivery failed to ${recipientNumber}:`, errorDetails);
    await NotificationLog.findByIdAndUpdate(logId, {
      status: NOTIFICATION_STATUS.FAILED,
      errorMessage: errorDetails,
      $inc: { retryCount: 1 },
    });
    await logAuditEvent({
      role: 'SYSTEM',
      action: AUDIT_ACTIONS.NOTIFICATION_FAILED,
      entity: 'NOTIFICATION',
      entityId: logId,
      description: `WhatsApp notification failed for ref ${referenceId}: ${errorDetails}`,
    });
  }
}

async function queueOrDispatchNotification({ recipientType, recipientNumber, referenceId, templateName, messageBody }) {
  try {
    const log = await NotificationLog.create({
      recipientType,
      recipientNumber,
      referenceId,
      templateName,
      messageBody,
      status: NOTIFICATION_STATUS.PENDING,
    });

    const jobData = {
      logId: log._id.toString(),
      recipientType,
      recipientNumber,
      referenceId,
      templateName,
      messageBody,
    };

    await addJob('send-whatsapp', jobData, processDirectDispatch);
    return log;
  } catch (error) {
    console.error('[WhatsAppService] Failed to create notification record:', error.message);
  }
}

/**
 * Section 20: Dispatches Payment Receipt to Customer
 */
export async function sendCustomerPaymentReceipt({ customer, payment, collector }) {
  if (!customer?.mobile) return;

  const messageBody = buildCustomerPaymentReceiptMessage({
    customerName: customer.shopName,
    receiptNumber: payment.receiptNumber,
    previousOutstanding: payment.previousOutstanding,
    amountReceived: payment.amount,
    currentOutstanding: payment.remainingOutstanding,
    collectedByName: collector.name,
    createdAt: payment.createdAt,
  });

  return queueOrDispatchNotification({
    recipientType: 'CUSTOMER',
    recipientNumber: customer.mobile,
    referenceId: payment.receiptNumber,
    templateName: WHATSAPP_TEMPLATES.PAYMENT_RECEIPT,
    messageBody,
  });
}

/**
 * Section 21: Dispatches Daily Collection Report to Owner when employee signs out
 */
export async function sendEmployeeDailyReport({
  session,
  employee,
  collections,
  totalTransactions,
  totalCollected,
}) {
  if (!config.whatsapp.ownerNumber) return;

  const messageBody = buildOwnerDailyReportMessage({
    employeeName: employee.name,
    dateStr: session.date,
    signInTime: session.signInTime,
    signInLocation: session.signInLocation,
    signOutTime: session.signOutTime,
    signOutLocation: session.signOutLocation,
    totalTransactions,
    totalCashCollected: totalCollected,
    collections,
    expectedCash: totalCollected,
  });

  return queueOrDispatchNotification({
    recipientType: 'OWNER',
    recipientNumber: config.whatsapp.ownerNumber,
    referenceId: session.workSessionId,
    templateName: WHATSAPP_TEMPLATES.EMPLOYEE_DAILY_REPORT,
    messageBody,
  });
}

export async function getNotificationLogs(filter = {}, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    NotificationLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    NotificationLog.countDocuments(filter),
  ]);
  return { logs, total, page, totalPages: Math.ceil(total / limit) };
}

export async function retryNotification(logId) {
  const log = await NotificationLog.findById(logId);
  if (!log) throw new Error('Notification record not found');

  log.status = NOTIFICATION_STATUS.PENDING;
  await log.save();

  await processDirectDispatch({
    logId: log._id.toString(),
    recipientType: log.recipientType,
    recipientNumber: log.recipientNumber,
    referenceId: log.referenceId,
    templateName: log.templateName,
    messageBody: log.messageBody,
  });

  return NotificationLog.findById(logId);
}
