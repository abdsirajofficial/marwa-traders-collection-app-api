import axios from 'axios';
import { config } from '../../common/config/index.js';
import { NotificationLog } from './whatsapp.model.js';
import {
  buildCustomerPaymentReceiptMessage,
  buildOwnerDailyReportMessage,
  formatCurrency,
  formatDateTime,
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
async function sendWhatsAppHttp(recipientNumber, messageBody, templateName = null, templateParams = null) {
  const formattedNumber = formatWhatsAppNumber(recipientNumber);

  if (config.whatsapp.accessToken && config.whatsapp.phoneNumberId) {
    const url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`;
    console.log(`[WhatsAppService] Dispatching WhatsApp message to ${formattedNumber} (${url})...`);

    const payload = (templateName && Array.isArray(templateParams) && templateParams.length > 0)
      ? {
          messaging_product: 'whatsapp',
          to: formattedNumber,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: templateParams.map((p) => ({ type: 'text', text: String(p) })),
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: formattedNumber,
          type: 'text',
          text: { body: messageBody },
        };

    return axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  // Simulated provider mode (Dev/Test)
  console.log(`[WhatsApp Provider] Sending to ${formattedNumber}:\n${messageBody}\n----------------------------------`);
  return { status: 200, data: { messages: [{ id: `wamid.mock.${Date.now()}` }] } };
}

async function processDirectDispatch(jobData) {
  const { logId, recipientNumber, messageBody, referenceId, recipientType, templateName, templateParams } = jobData;
  try {
    const res = await sendWhatsAppHttp(recipientNumber, messageBody, templateName, templateParams);
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

async function queueOrDispatchNotification({ recipientType, recipientNumber, referenceId, templateName, templateParams = null, messageBody }) {
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
      templateParams,
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

  const { dateStr, timeStr } = formatDateTime(payment.createdAt);

  const messageBody = buildCustomerPaymentReceiptMessage({
    customerName: customer.shopName,
    receiptNumber: payment.receiptNumber,
    previousOutstanding: payment.previousOutstanding,
    amountReceived: payment.amount,
    currentOutstanding: payment.remainingOutstanding,
    collectedByName: collector.name,
    createdAt: payment.createdAt,
  });

  const templateParams = [
    customer.shopName || 'Customer',
    payment.receiptNumber || 'N/A',
    formatCurrency(payment.previousOutstanding),
    formatCurrency(payment.amount),
    formatCurrency(payment.remainingOutstanding),
    collector?.name || 'Collector',
    dateStr,
    timeStr,
  ];

  return queueOrDispatchNotification({
    recipientType: 'CUSTOMER',
    recipientNumber: customer.mobile,
    referenceId: payment.receiptNumber,
    templateName: WHATSAPP_TEMPLATES.PAYMENT_RECEIPT,
    templateParams,
    messageBody,
  });
}

/**
 * Section 21: Dispatches Daily Collection Report to Owner when employee signs out
 */
export async function sendEmployeeDailyReport({
  session,
  employee,
  collections = [],
  totalTransactions = 0,
  totalCollected = 0,
}) {
  if (!config.whatsapp.ownerNumber) return;

  const signInTimeStr = formatDateTime(session.signInTime).timeStr;
  const signOutTimeStr = formatDateTime(session.signOutTime).timeStr;
  const signInLocStr = session.signInLocation?.address || (session.signInLocation?.latitude ? `${session.signInLocation.latitude}, ${session.signInLocation.longitude}` : 'Salem');
  const signOutLocStr = session.signOutLocation?.address || (session.signOutLocation?.latitude ? `${session.signOutLocation.latitude}, ${session.signOutLocation.longitude}` : 'Salem');

  // Calculate settlement status
  const settledCollections = (collections || []).filter((c) => c.settled);
  const settledAmount = settledCollections.reduce((sum, c) => sum + (c.amount || 0), 0);
  const unsettledAmount = Math.max(0, (totalCollected || 0) - settledAmount);
  const settlementStatus = unsettledAmount > 0
    ? `PENDING (₹${formatCurrency(unsettledAmount)})`
    : `SETTLED`;

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

  const templateParams = [
    employee.name || 'Employee',
    session.date || formatDateTime().dateStr,
    signInTimeStr,
    signInLocStr,
    signOutTimeStr,
    signOutLocStr,
    String(totalTransactions),
    formatCurrency(totalCollected),
    settlementStatus,
    formatCurrency(totalCollected),
  ];

  return queueOrDispatchNotification({
    recipientType: 'OWNER',
    recipientNumber: config.whatsapp.ownerNumber,
    referenceId: session.workSessionId,
    templateName: WHATSAPP_TEMPLATES.EMPLOYEE_DAILY_REPORT,
    templateParams,
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
