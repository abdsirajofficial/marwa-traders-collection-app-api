import { PaymentCorrection } from '../models/PaymentCorrection.js';
import { Payment } from '../models/Payment.js';
import { Invoice } from '../models/Invoice.js';
import { Customer } from '../models/Customer.js';
import { computeCustomerOutstanding } from './customerService.js';
import { createPayment } from './paymentService.js';
import { logAuditEvent } from './auditService.js';

export async function requestPaymentCorrection({ paymentId, requestedAmount, reason, user }) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error('Payment not found');

  if (payment.status === 'REVERSED') {
    throw new Error('This payment has already been reversed');
  }

  // Cash collector can only request for their own collections
  if (user.role === 'CASH_COLLECTOR' && payment.collectedBy.toString() !== user._id.toString()) {
    throw new Error('You can only request corrections for payments you collected');
  }

  // Check if a pending correction request already exists
  const existingPending = await PaymentCorrection.findOne({
    paymentId: payment._id,
    status: 'PENDING',
  });
  if (existingPending) {
    throw new Error('A correction request is already pending for this payment');
  }

  const correction = await PaymentCorrection.create({
    paymentId: payment._id,
    receiptNumber: payment.receiptNumber,
    customerId: payment.customerId,
    requestedBy: user._id,
    originalAmount: payment.amount,
    requestedAmount: Number(requestedAmount),
    reason,
    status: 'PENDING',
  });

  await logAuditEvent({
    userId: user._id,
    userCode: user.code,
    role: user.role,
    action: 'PAYMENT_CORRECTION_REQUEST',
    entity: 'PAYMENT_CORRECTION',
    entityId: correction._id.toString(),
    description: `Correction requested for receipt #${payment.receiptNumber}. Original: ₹${payment.amount}, Corrected: ₹${requestedAmount}. Reason: ${reason}`,
    metadata: {
      paymentId: payment._id,
      receiptNumber: payment.receiptNumber,
      originalAmount: payment.amount,
      requestedAmount,
      reason,
    },
  });

  return correction;
}

export async function reviewPaymentCorrection({ correctionId, status, reviewNotes, reviewer }) {
  if (!['OWNER', 'ADMIN'].includes(reviewer.role)) {
    throw new Error('Only Owner or Admin can review payment corrections');
  }

  const correction = await PaymentCorrection.findById(correctionId);
  if (!correction) throw new Error('Correction request not found');

  if (correction.status !== 'PENDING') {
    throw new Error(`This correction request has already been ${correction.status.toLowerCase()}`);
  }

  const payment = await Payment.findById(correction.paymentId);
  if (!payment) throw new Error('Associated payment record not found');

  if (status === 'REJECTED') {
    correction.status = 'REJECTED';
    correction.reviewedBy = reviewer._id;
    correction.reviewNotes = reviewNotes || 'Rejected by management';
    correction.reviewedAt = new Date();
    await correction.save();

    await logAuditEvent({
      userId: reviewer._id,
      userCode: reviewer.code,
      role: reviewer.role,
      action: 'PAYMENT_CORRECTION_REJECTED',
      entity: 'PAYMENT_CORRECTION',
      entityId: correction._id.toString(),
      description: `Correction for receipt #${payment.receiptNumber} rejected. Notes: ${correction.reviewNotes}`,
    });

    return correction;
  }

  if (status === 'APPROVED') {
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
        if (invoice.outstandingAmount >= invoice.invoiceAmount) {
          invoice.status = 'UNPAID';
        } else {
          invoice.status = 'PARTIALLY_PAID';
        }
        await invoice.save();
      }
    }

    // 3. Re-calculate customer outstanding
    await computeCustomerOutstanding(payment.customerId);

    // 4. If requestedAmount > 0, generate new corrected payment
    let newPayment = null;
    if (correction.requestedAmount > 0) {
      const result = await createPayment({
        customerId: payment.customerId,
        amount: correction.requestedAmount,
        paymentMode: 'CASH',
        location: payment.location,
        collector: reviewer, // or original collector
      });
      newPayment = result.payment;
    }

    // 5. Update correction record
    correction.status = 'APPROVED';
    correction.reviewedBy = reviewer._id;
    correction.reviewNotes = reviewNotes || 'Correction approved and transaction reversed.';
    correction.reviewedAt = new Date();
    await correction.save();

    await logAuditEvent({
      userId: reviewer._id,
      userCode: reviewer.code,
      role: reviewer.role,
      action: 'PAYMENT_CORRECTION_APPROVED',
      entity: 'PAYMENT_CORRECTION',
      entityId: correction._id.toString(),
      description: `Correction for receipt #${payment.receiptNumber} approved. Original reversed. New Receipt: ${newPayment ? newPayment.receiptNumber : 'None'}`,
      metadata: {
        originalPaymentId: payment._id,
        newPaymentId: newPayment?._id,
        newReceiptNumber: newPayment?.receiptNumber,
      },
    });

    return { correction, originalPayment: payment, newPayment };
  }

  throw new Error('Invalid status. Must be APPROVED or REJECTED');
}

export async function getCorrections({ status, page = 1, limit = 50 }) {
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
}
