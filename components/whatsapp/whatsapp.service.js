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
 * Low-level HTTP dispatch to WhatsApp Cloud API / provider
 */
async function sendWhatsAppHttp(recipientNumber, messageBody) {
  if (config.whatsapp.accessToken && config.whatsapp.phoneNumberId) {
    const url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`;
    return axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: recipientNumber.replace(/\D/g, ''),
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
  console.log(`[WhatsApp Provider] Sending to ${recipientNumber}:\n${messageBody}\n----------------------------------`);
  return { status: 200, data: { messages: [{ id: `wamid.mock.${Date.now()}` }] } };
}

async function processDirectDispatch(jobData) {
  const { logId, recipientNumber, messageBody, referenceId, recipientType } = jobData;
  try {
    await sendWhatsAppHttp(recipientNumber, messageBody);
    await NotificationLog.findByIdAndUpdate(logId, { status: NOTIFICATION_STATUS.SENT });
    await logAuditEvent({
      role: 'SYSTEM',
      action: AUDIT_ACTIONS.NOTIFICATION_SENT,
      entity: 'NOTIFICATION',
      entityId: logId,
      description: `WhatsApp ${recipientType} notification sent for ref: ${referenceId}`,
    });
  } catch (error) {
    console.error(`[WhatsAppService] Delivery failed to ${recipientNumber}:`, error.message);
    await NotificationLog.findByIdAndUpdate(logId, {
      status: NOTIFICATION_STATUS.FAILED,
      errorMessage: error.message,
      $inc: { retryCount: 1 },
    });
    await logAuditEvent({
      role: 'SYSTEM',
      action: AUDIT_ACTIONS.NOTIFICATION_FAILED,
      entity: 'NOTIFICATION',
      entityId: logId,
      description: `WhatsApp notification failed for ref ${referenceId}: ${error.message}`,
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
