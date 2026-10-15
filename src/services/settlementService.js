import { Settlement } from '../models/Settlement.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { generateSettlementNumber } from '../utils/receiptGenerator.js';
import { logAuditEvent } from './auditService.js';

/**
 * Calculates current unsettled cash for an employee
 */
export async function getEmployeeExpectedCash(employeeId) {
  const employee = await User.findById(employeeId);
  if (!employee) throw new Error('Employee not found');

  // Find all COMPLETED payments collected by employee that are not yet marked settled
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
    paymentIds: unsettledPayments.map(p => p._id),
  };
}

/**
 * Records employee cash settlement by Owner/Admin
 */
export async function createSettlement({
  employeeId,
  receivedAmount,
  notes = '',
  settledBy,
}) {
  // Cash collector cannot settle their own cash
  if (settledBy._id.toString() === employeeId.toString()) {
    throw new Error('Cash collectors cannot settle their own cash collections');
  }

  if (!['OWNER', 'ADMIN'].includes(settledBy.role)) {
    throw new Error('Only Owner or Admin can record cash settlements');
  }

  const { expectedAmount, paymentIds } = await getEmployeeExpectedCash(employeeId);

  const numReceived = Number(receivedAmount);
  if (isNaN(numReceived) || numReceived < 0) {
    throw new Error('Received amount must be a non-negative number');
  }

  const difference = numReceived - expectedAmount;

  let status = 'SETTLED';
  if (difference < 0) {
    // If notes or explicitly indicated as partial vs shortage
    if (notes && notes.toLowerCase().includes('partial')) {
      status = 'PARTIALLY_SETTLED';
    } else {
      status = 'SHORTAGE';
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

  // Mark covered payments as settled
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
    action: 'CREATE_SETTLEMENT',
    entity: 'SETTLEMENT',
    entityId: settlement._id.toString(),
    description: `Settlement #${settlementNumber}: Expected ₹${expectedAmount.toLocaleString('en-IN')}, Received ₹${numReceived.toLocaleString('en-IN')}, Diff: ₹${difference.toLocaleString('en-IN')}, Status: ${status}`,
    metadata: {
      settlementNumber,
      expectedAmount,
      receivedAmount: numReceived,
      difference,
      status,
      employeeId,
      settledBy: settledBy._id,
    },
  });

  const populated = await Settlement.findById(settlement._id)
    .populate('employeeId', 'name code role')
    .populate('settledBy', 'name code role');

  return populated;
}

export async function getSettlements({ employeeId, status, page = 1, limit = 50 }) {
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
}

export async function getSettlementById(id) {
  const settlement = await Settlement.findById(id)
    .populate('employeeId', 'name code role')
    .populate('settledBy', 'name code role')
    .populate('paymentIds', 'receiptNumber amount createdAt customerId');

  if (!settlement) throw new Error('Settlement record not found');
  return settlement;
}
