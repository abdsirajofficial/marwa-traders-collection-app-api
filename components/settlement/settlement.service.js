import { Settlement, PaymentCorrection } from './settlement.model.js';
import { Payment } from '../payment/payment.model.js';
import { User } from '../user/user.model.js';
import { Invoice } from '../invoice/invoice.model.js';
import { computeCustomerOutstanding } from '../customer/customer.service.js';
import { generateSettlementNumber } from './settlement.helper.js';
import { logAuditEvent } from '../audit-log/audit-log.service.js';
import { ApiError } from '../../common/utils/api-error.util.js';
import { ROLES, SETTLEMENT_STATUS, CORRECTION_STATUS, AUDIT_ACTIONS } from '../../common/utils/constants.js';

export const getEmployeeExpectedCash = async (employeeId) => {
  const employee = await User.findById(employeeId);
  if (!employee) throw new ApiError(404, 'Employee not found');

  const unsettledPayments = await Payment.find({
    collectedBy: employee._id,
    status: 'COMPLETED',
    settled: { $ne: true },
  }).sort({ createdAt: 1 });

  const expectedAmount = unsettledPayments.reduce((sum, p) => sum + p.amount, 0);

  return {
    employee: {
      _id: employee._id,
      name: employee.name,
      code: employee.code,
      role: employee.role,
    },
    expectedAmount,
    unsettledPaymentCount: unsettledPayments.length,
    paymentIds: unsettledPayments.map((p) => p._id),
  };
};

export const createSettlement = async ({
  employeeId,
  receivedAmount,
  notes = '',
  settledBy,
  ipAddress = null,
}) => {
  if (settledBy._id.toString() === employeeId.toString()) {
    throw new ApiError(403, 'Cash collectors cannot settle their own cash collections');
  }

  if (![ROLES.OWNER, ROLES.ADMIN].includes(settledBy.role)) {
    throw new ApiError(403, 'Only Owner or Admin can record cash settlements');
  }

  const { expectedAmount, paymentIds } = await getEmployeeExpectedCash(employeeId);

  const numReceived = Number(receivedAmount);
  if (isNaN(numReceived) || numReceived < 0) {
    throw new ApiError(400, 'Received amount must be a non-negative number');
  }

  const difference = numReceived - expectedAmount;

  let status = SETTLEMENT_STATUS.SETTLED;
  if (difference < 0) {
    if (notes && notes.toLowerCase().includes('partial')) {
      status = SETTLEMENT_STATUS.PARTIALLY_SETTLED;
    } else {
      status = SETTLEMENT_STATUS.SHORTAGE;
    }
  }

  const settlementNumber = await generateSettlementNumber();

  const settlement = await Settlement.create({
    settlementNumber,
    employeeId,
    settlementDate: new Date(),
    expectedAmount,
    receivedAmount: numReceived,
    difference,
    status,
    paymentIds,
    notes,
    settledBy: settledBy._id,
    settledAt: new Date(),
  });

  if (paymentIds.length > 0) {
    await Payment.updateMany(
      { _id: { $in: paymentIds } },
      { $set: { settled: true, settlementId: settlement._id } }
    );
  }

  await logAuditEvent({
    userId: settledBy._id,
    userCode: settledBy.code,
    role: settledBy.role,
    action: AUDIT_ACTIONS.CREATE_SETTLEMENT,
    entity: 'SETTLEMENT',
    entityId: settlement._id.toString(),
    description: `Settlement #${settlementNumber}: Expected ₹${expectedAmount.toLocaleString('en-IN')}, Received ₹${numReceived.toLocaleString('en-IN')}, Diff: ₹${difference.toLocaleString('en-IN')}, Status: ${status}`,
    ipAddress,
    metadata: {
      settlementNumber,
      expectedAmount,
      receivedAmount: numReceived,
      difference,
      status,
      employeeId,
    },
  });

  return Settlement.findById(settlement._id)
    .populate('employeeId', 'name code role')
    .populate('settledBy', 'name code role');
};

export const getSettlements = async ({ employeeId, status, page = 1, limit = 50 }) => {
  const filter = {};
  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [settlements, total] = await Promise.all([
    Settlement.find(filter)
      .populate('employeeId', 'name code role')
      .populate('settledBy', 'name code role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Settlement.countDocuments(filter),
  ]);

  return { settlements, total, page, totalPages: Math.ceil(total / limit) };
};

export const getSettlementById = async (id) => {
  const settlement = await Settlement.findById(id)
    .populate('employeeId', 'name code role')
    .populate('settledBy', 'name code role')
    .populate('paymentIds', 'receiptNumber amount createdAt customerId');

  if (!settlement) throw new ApiError(404, 'Settlement record not found');
  return settlement;
};

export const requestPaymentCorrection = async ({ paymentId, requestedAmount, reason, user, ipAddress = null }) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');

  if (payment.status === 'REVERSED') {
    throw new ApiError(400, 'This payment has already been reversed');
  }

  if (user.role === ROLES.CASH_COLLECTOR && payment.collectedBy.toString() !== user._id.toString()) {
    throw new ApiError(403, 'You can only request corrections for payments you collected');
  }

  const existingPending = await PaymentCorrection.findOne({
    paymentId: payment._id,
    status: CORRECTION_STATUS.PENDING,
  });
  if (existingPending) {
    throw new ApiError(400, 'A correction request is already pending for this payment');
  }

  const correction = await PaymentCorrection.create({
    paymentId: payment._id,
    receiptNumber: payment.receiptNumber,
    customerId: payment.customerId,
    requestedBy: user._id,
    originalAmount: payment.amount,
    requestedAmount: Number(requestedAmount),
    reason,
    status: CORRECTION_STATUS.PENDING,
  });

  await logAuditEvent({
    userId: user._id,
    userCode: user.code,
    role: user.role,
    action: AUDIT_ACTIONS.PAYMENT_CORRECTION_REQUEST,
    entity: 'PAYMENT_CORRECTION',
    entityId: correction._id.toString(),
    description: `Correction requested for receipt #${payment.receiptNumber}. Original: ₹${payment.amount}, Corrected: ₹${requestedAmount}. Reason: ${reason}`,
    ipAddress,
  });

  return correction;
};

export const reviewPaymentCorrection = async ({ correctionId, status, reviewNotes, reviewer, ipAddress = null }) => {
  if (![ROLES.OWNER, ROLES.ADMIN].includes(reviewer.role)) {
    throw new ApiError(403, 'Only Owner or Admin can review payment corrections');
  }

  const correction = await PaymentCorrection.findById(correctionId);
  if (!correction) throw new ApiError(404, 'Correction request not found');

  if (correction.status !== CORRECTION_STATUS.PENDING) {
    throw new ApiError(400, `This correction request has already been ${correction.status.toLowerCase()}`);
  }

  const payment = await Payment.findById(correction.paymentId);
  if (!payment) throw new ApiError(404, 'Associated payment record not found');

  if (status === CORRECTION_STATUS.REJECTED) {
    correction.status = CORRECTION_STATUS.REJECTED;
    correction.reviewedBy = reviewer._id;
    correction.reviewNotes = reviewNotes || 'Rejected by management';
    correction.reviewedAt = new Date();
    await correction.save();

    await logAuditEvent({
      userId: reviewer._id,
      userCode: reviewer.code,
      role: reviewer.role,
      action: AUDIT_ACTIONS.PAYMENT_CORRECTION_REJECTED,
      entity: 'PAYMENT_CORRECTION',
      entityId: correction._id.toString(),
      description: `Correction for receipt #${payment.receiptNumber} rejected. Notes: ${correction.reviewNotes}`,
      ipAddress,
    });

    return { correction };
  }

  if (status === CORRECTION_STATUS.APPROVED) {
    // 1. Mark original payment as REVERSED (DO NOT DELETE!)
    payment.status = 'REVERSED';
    payment.reversalReason = `Correction approved: ${correction.reason}`;
    payment.reversedBy = reviewer._id;
    payment.reversedAt = new Date();
    await payment.save();

    // 2. Rollback invoice allocations
    for (const allocation of payment.allocations) {
      const invoice = await Invoice.findById(allocation.invoiceId);
      if (invoice) {
        invoice.outstandingAmount += allocation.amountAllocated;
        invoice.status = invoice.outstandingAmount >= invoice.invoiceAmount ? 'UNPAID' : 'PARTIALLY_PAID';
        await invoice.save();
      }
    }

    // 3. Re-calculate customer outstanding
    await computeCustomerOutstanding(payment.customerId);

    // 4. If requestedAmount > 0, generate new corrected payment
    let newPayment = null;
    if (correction.requestedAmount > 0) {
      const { createPayment } = await import('../payment/payment.service.js');
      const result = await createPayment({
        customerId: payment.customerId.toString(),
        amount: correction.requestedAmount,
        paymentMode: 'CASH',
        location: payment.location,
        collector: reviewer,
        notes: `Corrected replacement for #${payment.receiptNumber}`,
      });
      newPayment = result.payment;
    }

    // 5. Update correction record
    correction.status = CORRECTION_STATUS.APPROVED;
    correction.reviewedBy = reviewer._id;
    correction.reviewNotes = reviewNotes || 'Correction approved and original reversed.';
    correction.reviewedAt = new Date();
    await correction.save();

    await logAuditEvent({
      userId: reviewer._id,
      userCode: reviewer.code,
      role: reviewer.role,
      action: AUDIT_ACTIONS.PAYMENT_CORRECTION_APPROVED,
      entity: 'PAYMENT_CORRECTION',
      entityId: correction._id.toString(),
      description: `Correction for receipt #${payment.receiptNumber} approved. Original marked REVERSED. Replacement: ${newPayment ? newPayment.receiptNumber : 'None'}`,
      ipAddress,
    });

    return { correction, originalPayment: payment, newPayment };
  }

  throw new ApiError(400, 'Invalid status. Must be APPROVED or REJECTED');
};

export const getCorrections = async ({ status, page = 1, limit = 50 }) => {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [corrections, total] = await Promise.all([
    PaymentCorrection.find(filter)
      .populate('customerId', 'shopName ownerName customerCode')
      .populate('requestedBy', 'name code role')
      .populate('reviewedBy', 'name code role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PaymentCorrection.countDocuments(filter),
  ]);

  return { corrections, total, page, totalPages: Math.ceil(total / limit) };
};
