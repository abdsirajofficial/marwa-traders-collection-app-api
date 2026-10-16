import { Payment } from './payment.model.js';
import { Customer } from '../customer/customer.model.js';
import { Invoice } from '../invoice/invoice.model.js';
import { EmployeeAttendance } from '../employee-attendance/employee-attendance.model.js';
import { ApiError } from '../../common/utils/api-error.util.js';
import { logAuditEvent } from '../audit-log/audit-log.service.js';
import { NotificationService } from '../../common/service/notification.service.js';
import { generateReceiptNumber } from './payment.helper.js';
import { computeCustomerOutstanding } from '../customer/customer.service.js';
import { ROLES, ATTENDANCE_STATUS, AUDIT_ACTIONS } from '../../common/utils/constants.js';

/**
 * Creates and confirms a payment.
 * Requires ACTIVE workSession for Cash Collectors.
 * Sends WhatsApp ONLY to customer (NO owner WhatsApp per Part 19).
 */
export const createPayment = async ({
  customerId,
  amount,
  paymentMode = 'CASH',
  location = {},
  idempotencyKey = null,
  collector,
  ipAddress = null,
}) => {
  // Only OWNER and CASH_COLLECTOR are authorized to collect money from shops
  if (collector.role !== ROLES.OWNER && collector.role !== ROLES.CASH_COLLECTOR) {
    throw new ApiError(
      403,
      'Unauthorized: Only the Owner and Cash Collectors are authorized to collect money from shops.'
    );
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new ApiError(400, 'Payment amount must be a positive number');
  }

  // 1. Enforce / Link ACTIVE Work Session for Cash Collector (and Owner if active)
  let activeWorkSessionId = null;
  const activeSession = await EmployeeAttendance.findOne({
    employeeId: collector._id,
    status: ATTENDANCE_STATUS.ACTIVE,
  });

  if (activeSession) {
    activeWorkSessionId = activeSession.workSessionId;
  } else if (collector.role === ROLES.CASH_COLLECTOR) {
    throw new ApiError(
      403,
      'Employee must be signed in with an active work session before collecting payments. Please click SIGN IN.'
    );
  }

  // 2. Idempotency Check
  if (idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey })
      .populate('customerId', 'shopName ownerName customerCode mobile address')
      .populate('collectedBy', 'name code');
    if (existing) {
      return { payment: existing, isDuplicate: true };
    }
  }

  // 3. Customer validation & Outstanding Check
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const totalOutstanding = await computeCustomerOutstanding(customer._id);
  if (totalOutstanding <= 0) {
    throw new ApiError(400, `Customer ${customer.shopName} has no outstanding balance. Payment cannot be collected.`);
  }

  if (numAmount > totalOutstanding) {
    throw new ApiError(
      400,
      `Payment amount (₹${numAmount.toLocaleString('en-IN')}) exceeds total customer outstanding balance (₹${totalOutstanding.toLocaleString('en-IN')}). Overpayment is not allowed.`
    );
  }

  // 4. FIFO Oldest-Invoice First Allocation
  const unpaidInvoices = await Invoice.find({
    customerId: customer._id,
    outstandingAmount: { $gt: 0 },
  }).sort({ invoiceDate: 1, createdAt: 1 });

  let unallocated = numAmount;
  const allocations = [];

  for (const invoice of unpaidInvoices) {
    if (unallocated <= 0) break;

    const amountForThis = Math.min(invoice.outstandingAmount, unallocated);
    invoice.outstandingAmount -= amountForThis;
    unallocated -= amountForThis;

    invoice.status = invoice.outstandingAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
    await invoice.save();

    allocations.push({
      invoiceId: invoice._id,
      amountAllocated: amountForThis,
    });
  }

  // 5. Unique Server-Side Receipt Sequence
  const receiptNumber = await generateReceiptNumber();
  const previousOutstanding = totalOutstanding;
  const remainingOutstanding = Math.max(0, previousOutstanding - numAmount);

  // 6. Persist Immutable Payment with workSessionId
  const payment = await Payment.create({
    receiptNumber,
    workSessionId: activeWorkSessionId,
    customerId: customer._id,
    amount: numAmount,
    previousOutstanding,
    remainingOutstanding,
    paymentMode: paymentMode || 'CASH',
    collectedBy: collector._id,
    location: {
      locationName: location.locationName || (location.latitude ? `${location.latitude}, ${location.longitude}` : `${customer.shopName}, ${customer.address}`),
      latitude: location.latitude !== undefined && location.latitude !== null ? location.latitude : null,
      longitude: location.longitude !== undefined && location.longitude !== null ? location.longitude : null,
      address: location.address || (location.latitude ? `${location.latitude}, ${location.longitude}` : customer.address || null),
    },
    status: 'COMPLETED',
    allocations,
    idempotencyKey: idempotencyKey || null,
  });

  // Increment live work session totals in EmployeeAttendance
  if (activeWorkSessionId) {
    await EmployeeAttendance.findOneAndUpdate(
      { workSessionId: activeWorkSessionId },
      { $inc: { totalTransactions: 1, totalCollected: numAmount } }
    ).catch((err) => console.warn('Failed to update live session totals:', err.message));
  }

  // 7. Update Customer Outstanding
  customer.currentOutstanding = remainingOutstanding;
  await customer.save();

  // 8. Audit Logging (Part 31)
  await logAuditEvent({
    userId: collector._id,
    userCode: collector.code,
    role: collector.role,
    action: AUDIT_ACTIONS.EMPLOYEE_COLLECTION_CREATED,
    entity: 'PAYMENT',
    entityId: payment._id.toString(),
    description: `Cash collection of ₹${numAmount.toLocaleString('en-IN')} for ${customer.shopName} by ${collector.name}. Receipt: ${receiptNumber}. WorkSession: ${activeWorkSessionId || 'Direct'}`,
    ipAddress,
    metadata: {
      receiptNumber,
      amount: numAmount,
      workSessionId: activeWorkSessionId,
      customerId: customer._id,
    },
  });

  // 9. Customer WhatsApp notification (Part 19: Customer receives WhatsApp, OWNER DOES NOT receive individual WhatsApp!)
  NotificationService.notifyCustomerPayment({
    customer,
    payment,
    collector,
  }).catch((err) => {
    console.error('[PaymentService] Customer WhatsApp notification error:', err.message);
  });

  const populated = await Payment.findById(payment._id)
    .populate('customerId', 'shopName ownerName customerCode mobile address')
    .populate('collectedBy', 'name code');

  return { payment: populated, isDuplicate: false };
};

export const getPayments = async ({
  customerId,
  employeeId,
  workSessionId,
  status,
  startDate,
  endDate,
  page = 1,
  limit = 50,
}) => {
  const filter = {};
  if (customerId) filter.customerId = customerId;
  if (employeeId) filter.collectedBy = employeeId;
  if (workSessionId) filter.workSessionId = workSessionId;
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
};

export const getPaymentById = async (id) => {
  const payment = await Payment.findById(id)
    .populate('customerId', 'shopName ownerName customerCode mobile address')
    .populate('collectedBy', 'name code')
    .populate('allocations.invoiceId', 'invoiceNumber invoiceAmount');

  if (!payment) throw new ApiError(404, 'Payment receipt not found');
  return payment;
};

export const getCollectorTodaySummary = async (employeeId) => {
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
};

export const getPaymentByReceiptNumber = async (receiptNumber) => {
  const payment = await Payment.findOne({ receiptNumber })
    .populate('customerId', 'shopName ownerName customerCode mobile address')
    .populate('collectedBy', 'name code')
    .populate('allocations.invoiceId', 'invoiceNumber invoiceAmount');

  if (!payment) throw new ApiError(404, 'Payment receipt not found');
  return payment;
};

