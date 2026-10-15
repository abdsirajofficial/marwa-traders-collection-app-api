import axios from 'axios';
import { config } from '../config/env.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { logAuditEvent } from './auditService.js';

let notificationQueue = null;

// Dynamically initialize BullMQ only if Redis credentials exist
async function initQueueIfRedisAvailable() {
  if (config.redis.isConfigured) {
    try {
      const { Queue, Worker } = await import('bullmq');
      const IORedis = (await import('ioredis')).default;
      
      const redisConnection = new IORedis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
      });

      notificationQueue = new Queue('whatsapp-notifications', { connection: redisConnection });

      new Worker(
        'whatsapp-notifications',
        async (job) => {
          await executeDirectNotification(job.data);
        },
        { connection: redisConnection }
      );

      console.log('[NotificationService] Redis/BullMQ queue successfully initialized.');
    } catch (err) {
      console.warn('[NotificationService] Redis detected but failed to connect. Falling back to direct processing:', err.message);
      notificationQueue = null;
    }
  } else {
    console.log('[NotificationService] Running without Redis (Direct notification processing mode).');
  }
}

// Format currency in Indian standard (e.g. ₹40,000)
function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

// Format date & time
function formatDateTime(date = new Date()) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateStr = `${day}-${month}-${year}`;

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

  return { dateStr, timeStr };
}

/**
 * Format Customer WhatsApp Message
 */
export function buildCustomerWhatsAppMessage({
  customerName,
  receiptNumber,
  previousOutstanding,
  amountReceived,
  currentOutstanding,
  collectedByName,
  createdAt,
}) {
  const { dateStr, timeStr } = formatDateTime(createdAt);

  return `MARWA TRADERS\n\n` +
    `Payment received successfully.\n\n` +
    `Customer:\n${customerName}\n\n` +
    `Receipt No:\n${receiptNumber}\n\n` +
    `Previous Outstanding:\n${formatCurrency(previousOutstanding)}\n\n` +
    `Amount Received:\n${formatCurrency(amountReceived)}\n\n` +
    `Current Outstanding:\n${formatCurrency(currentOutstanding)}\n\n` +
    `Collected By:\n${collectedByName}\n\n` +
    `Date:\n${dateStr}\n\n` +
    `Time:\n${timeStr}\n\n` +
    `Thank you for your payment.`;
}

/**
 * Format Owner WhatsApp Message
 */
export function buildOwnerWhatsAppMessage({
  employeeName,
  customerName,
  amountCollected,
  previousOutstanding,
  currentOutstanding,
  receiptNumber,
  createdAt,
  locationName,
}) {
  const { dateStr, timeStr } = formatDateTime(createdAt);

  return `MARWA TRADERS – COLLECTION ALERT\n\n` +
    `Employee:\n${employeeName}\n\n` +
    `Customer:\n${customerName}\n\n` +
    `Amount Collected:\n${formatCurrency(amountCollected)}\n\n` +
    `Payment Mode:\nCash\n\n` +
    `Previous Outstanding:\n${formatCurrency(previousOutstanding)}\n\n` +
    `Current Outstanding:\n${formatCurrency(currentOutstanding)}\n\n` +
    `Receipt No:\n${receiptNumber}\n\n` +
    `Date:\n${dateStr}\n\n` +
    `Time:\n${timeStr}\n\n` +
    `Collection Location:\n${locationName || 'Counter'}`;
}

/**
 * Send WhatsApp text via Cloud API / Mock Provider
 */
async function sendWhatsAppHttp(recipientNumber, messageBody) {
  // If credentials are configured, send to Meta WhatsApp API
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

  // Development/Mock Mode: simulate successful external API dispatch
  console.log(`[WhatsApp Provider Simulated Dispatch] To: ${recipientNumber}`);
  console.log(`Message:\n${messageBody}\n----------------------------------`);
  return { status: 200, data: { messages: [{ id: `wamid.mock.${Date.now()}` }] } };
}

/**
 * Execute Direct Notification delivery
 */
async function executeDirectNotification({ logId, recipientNumber, messageBody, receiptNumber, recipientType }) {
  try {
    await sendWhatsAppHttp(recipientNumber, messageBody);
    await NotificationLog.findByIdAndUpdate(logId, { status: 'SENT' });
    await logAuditEvent({
      role: 'SYSTEM',
      action: 'NOTIFICATION_SENT',
      entity: 'NOTIFICATION',
      entityId: logId,
      description: `WhatsApp ${recipientType} notification sent for receipt ${receiptNumber}`,
    });
  } catch (error) {
    console.error(`[NotificationService] Delivery failed to ${recipientNumber}:`, error.message);
    await NotificationLog.findByIdAndUpdate(logId, {
      status: 'FAILED',
      errorMessage: error.message,
      $inc: { retryCount: 1 },
    });
    await logAuditEvent({
      role: 'SYSTEM',
      action: 'NOTIFICATION_FAILED',
      entity: 'NOTIFICATION',
      entityId: logId,
      description: `WhatsApp notification failed for receipt ${receiptNumber}: ${error.message}`,
    });
  }
}

/**
 * Queue or dispatch notification based on Redis availability
 */
async function dispatchNotification({ recipientType, recipientNumber, receiptNumber, type, messageBody }) {
  try {
    const log = await NotificationLog.create({
      recipientType,
      recipientNumber,
      receiptNumber,
      type,
      messageBody,
      status: 'PENDING',
    });

    const jobData = {
      logId: log._id.toString(),
      recipientType,
      recipientNumber,
      receiptNumber,
      messageBody,
    };

    if (notificationQueue) {
      await notificationQueue.add('send-whatsapp', jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    } else {
      // Direct async dispatch without blocking caller
      setImmediate(() => {
        executeDirectNotification(jobData).catch(err => {
          console.error('[NotificationService] Background execution error:', err.message);
        });
      });
    }

    return log;
  } catch (error) {
    console.error('[NotificationService] Failed to create notification log:', error.message);
  }
}

/**
 * High-level method called after payment creation
 */
export async function notifyPaymentCompleted({
  receiptNumber,
  customer,
  amount,
  previousOutstanding,
  remainingOutstanding,
  collector,
  location,
  createdAt,
}) {
  try {
    // 1. Notify Customer
    if (customer?.mobile) {
      const customerMsg = buildCustomerWhatsAppMessage({
        customerName: customer.shopName,
        receiptNumber,
        previousOutstanding,
        amountReceived: amount,
        currentOutstanding: remainingOutstanding,
        collectedByName: collector.name,
        createdAt,
      });

      await dispatchNotification({
        recipientType: 'CUSTOMER',
        recipientNumber: customer.mobile,
        receiptNumber,
        type: 'PAYMENT_RECEIPT',
        messageBody: customerMsg,
      });
    }

    // 2. Notify Owner
    if (config.whatsapp.ownerNumber) {
      const ownerMsg = buildOwnerWhatsAppMessage({
        employeeName: collector.name,
        customerName: customer.shopName,
        amountCollected: amount,
        previousOutstanding,
        currentOutstanding: remainingOutstanding,
        receiptNumber,
        createdAt,
        locationName: location?.locationName,
      });

      await dispatchNotification({
        recipientType: 'OWNER',
        recipientNumber: config.whatsapp.ownerNumber,
        receiptNumber,
        type: 'COLLECTION_ALERT',
        messageBody: ownerMsg,
      });
    }
  } catch (error) {
    // Payment MUST NOT fail because of notification
    console.error('[NotificationService] Non-blocking notification error:', error.message);
  }
}

/**
 * Retry a failed notification
 */
export async function retryNotification(logId) {
  const log = await NotificationLog.findById(logId);
  if (!log) throw new Error('Notification log not found');

  log.status = 'PENDING';
  await log.save();

  await executeDirectNotification({
    logId: log._id.toString(),
    recipientType: log.recipientType,
    recipientNumber: log.recipientNumber,
    receiptNumber: log.receiptNumber,
    messageBody: log.messageBody,
  });

  return NotificationLog.findById(logId);
}

// Initialize queue
initQueueIfRedisAvailable();
