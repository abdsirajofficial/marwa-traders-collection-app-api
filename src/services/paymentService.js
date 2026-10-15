import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { generateReceiptNumber } from '../utils/receiptGenerator.js';
import { notifyPaymentCompleted } from './notificationService.js';
import { logAuditEvent } from './auditService.js';
import { computeCustomerOutstanding } from './customerService.js';

/**
 * Creates and confirms a payment with atomic invoice allocation and receipt generation
 */
export async function createPayment({
  customerId,
  amount,
  paymentMode = 'CASH',
  location = {},
  idempotencyKey = null,
  collector,
}) {
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Payment amount must be a positive number');
  }

  // 1. Idempotency Check: prevent duplicate double-click submissions
  if (idempotencyKey) {
    const existingPayment = await Payment.findOne({ idempotencyKey })
      .populate('customerId', 'shopName ownerName customerCode mobile address')
      .populate('collectedBy', 'name code');
    if (existingPayment) {
      console.log(`[PaymentService] Idempotency hit for key ${idempotencyKey}. Returning existing payment.`);
      return { payment: existingPayment, isDuplicate: true };
    }
  }

  // 2. Validate Customer and Outstanding
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  // Ensure current outstanding is strictly up to date
  const totalOutstanding = await computeCustomerOutstanding(customer._id);
  if (totalOutstanding <= 0) {
    throw new Error(`Customer ${customer.shopName} has no outstanding balance. Payment cannot be collected.`);
  }

  // Reject overpayment (Section 12: Overpayment must be rejected)
  if (numAmount > totalOutstanding) {
    throw new Error(
      `Payment amount (₹${numAmount.toLocaleString('en-IN')}) exceeds total customer outstanding balance (₹${totalOutstanding.toLocaleString('en-IN')}). Overpayment is not allowed.`
    );
  }

  // 3. Allocate Payment to Oldest Invoices First (FIFO)
  const unpaidInvoices = await Invoice.find({
    customerId: customer._id,
    outstandingAmount: { $gt: 0 },
  }).sort({ invoiceDate: 1, createdAt: 1 });

  let unallocatedAmount = numAmount;
  const allocations = [];

  for (const invoice of unpaidInvoices) {
    if (unallocatedAmount <= 0) break;

    const amountForThisInvoice = Math.min(invoice.outstandingAmount, unallocatedAmount);
    invoice.outstandingAmount -= amountForThisInvoice;
    unallocatedAmount -= amountForThisInvoice;

    if (invoice.outstandingAmount === 0) {
      invoice.status = 'PAID';
    } else {
      invoice.status = 'PARTIALLY_PAID';
    }

    await invoice.save();

    allocations.push({
      invoiceId: invoice._id,
      amountAllocated: amountForThisInvoice,
    });
  }

  // 4. Generate unique server-side receipt number (MRT-YYYYMMDD-XXXXXX)
  const receiptNumber = await generateReceiptNumber();

  const previousOutstanding = totalOutstanding;
  const remainingOutstanding = Math.max(0, previousOutstanding - numAmount);

  // 5. Create Immutable Payment Record
  const payment = await Payment.create({
    receiptNumber,
    customerId: customer._id,
    amount: numAmount,
    previousOutstanding,
    remainingOutstanding,
    paymentMode: paymentMode || 'CASH',
    collectedBy: collector._id,
    location: {
      locationName: location.locationName || `${customer.shopName}, ${customer.address}`,
      latitude: location.latitude !== undefined ? location.latitude : null,
      longitude: location.longitude !== undefined ? location.longitude : null,
    },
    status: 'COMPLETED',
    allocations,
    idempotencyKey: idempotencyKey || null,
  });

  // 6. Update customer current outstanding
  customer.currentOutstanding = remainingOutstanding;
  await customer.save();

  // 7. Audit Logging
  await logAuditEvent({
    userId: collector._id,
    userCode: collector.code,
    role: collector.role,
    action: 'CREATE_PAYMENT',
    entity: 'PAYMENT',
    entityId: payment._id.toString(),
    description: `Cash payment of ₹${numAmount.toLocaleString('en-IN')} collected for ${customer.shopName} by ${collector.name}. Receipt: ${receiptNumber}`,
    metadata: {
      receiptNumber,
      amount: numAmount,
      previousOutstanding,
      remainingOutstanding,
      customerId: customer._id,
      collectedBy: collector._id,
    },
  });

  // 8. Non-blocking WhatsApp notifications (Customer & Owner)
  notifyPaymentCompleted({
    receiptNumber,
    customer,
    amount: numAmount,
    previousOutstanding,
    remainingOutstanding,
    collector,
    location: payment.location,
    createdAt: payment.createdAt,
  });

  const populatedPayment = await Payment.findById(payment._id)
    .populate('customerId', 'shopName ownerName customerCode mobile address')
    .populate('collectedBy', 'name code');

  return { payment: populatedPayment, isDuplicate: false };
}

export async function getPayments({
  customerId,
  employeeId,
  status,
  startDate,
  endDate,
  page = 1,
  limit = 50,
}) {
  const filter = {};
  if (customerId) filter.customerId = customerId;
  if (employeeId) filter.collectedBy = employeeId;
  if (status) filter.status = status;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('customerId', 'shopName ownerName customerCode mobile')
      .populate('collectedBy', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  return { payments, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getPaymentById(id) {
  const payment = await Payment.findById(id)
    .populate('customerId', 'shopName ownerName customerCode mobile address')
    .populate('collectedBy', 'name code')
    .populate('allocations.invoiceId', 'invoiceNumber invoiceAmount');

  if (!payment) throw new Error('Payment not found');
  return payment;
}

/**
 * Cash Collector specific view: today's summary & collections
 */
export async function getCollectorTodaySummary(employeeId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const filter = {
    collectedBy: employeeId,
    status: 'COMPLETED',
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  };

  const [aggregation, recentCollections] = await Promise.all([
    Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
    ]),
    Payment.find(filter)
      .populate('customerId', 'shopName ownerName customerCode')
      .sort({ createdAt: -1 }),
  ]);

  return {
    todayCollection: aggregation[0]?.totalCollected || 0,
    todayTransactionCount: aggregation[0]?.transactionCount || 0,
    recentCollections,
  };
}
