import { Payment } from '../models/Payment.js';
import { Customer } from '../models/Customer.js';
import { Invoice } from '../models/Invoice.js';
import { Settlement } from '../models/Settlement.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

export async function getDashboardMetrics() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Today's collections
  const todayPayments = await Payment.find({
    status: 'COMPLETED',
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  }).populate('collectedBy', 'name code');

  const todayTotalCollection = todayPayments.reduce((sum, p) => sum + p.amount, 0);
  const todayTransactions = todayPayments.length;
  const todayCash = todayTotalCollection;

  // 2. Settlement status for today's money
  const settledPayments = todayPayments.filter((p) => p.settled);
  const settledAmount = settledPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingSettlement = todayTotalCollection - settledAmount;

  // 3. Shortages today
  const todaySettlements = await Settlement.find({
    settlementDate: { $gte: startOfDay, $lte: endOfDay },
  });
  const todayShortage = todaySettlements.reduce((sum, s) => {
    return s.difference < 0 ? sum + Math.abs(s.difference) : sum;
  }, 0);

  // 4. Overall Customer Outstanding
  const customerAggregation = await Customer.aggregate([
    { $group: { _id: null, totalOutstanding: { $sum: '$currentOutstanding' } } },
  ]);
  const totalOutstanding = customerAggregation[0]?.totalOutstanding || 0;

  // 5. Employee summary breakdown for today
  const employeeMap = {};
  for (const payment of todayPayments) {
    const empId = payment.collectedBy?._id?.toString() || 'unknown';
    const empName = payment.collectedBy?.name || 'Unknown';
    const empCode = payment.collectedBy?.code || '';

    if (!employeeMap[empId]) {
      employeeMap[empId] = {
        employeeId: empId,
        name: empName,
        code: empCode,
        transactions: 0,
        amount: 0,
      };
    }
    employeeMap[empId].transactions += 1;
    employeeMap[empId].amount += payment.amount;
  }

  const employeeSummary = Object.values(employeeMap);

  return {
    today: {
      totalCollection: todayTotalCollection,
      transactions: todayTransactions,
      cash: todayCash,
      pendingSettlement,
      settled: settledAmount,
      shortage: todayShortage,
      outstanding: totalOutstanding,
    },
    employeeSummary,
  };
}

export async function getCollectionReport({ startDate, endDate, employeeId, customerId, status }) {
  const filter = {};
  if (status) filter.status = status;
  if (employeeId) filter.collectedBy = employeeId;
  if (customerId) filter.customerId = customerId;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const payments = await Payment.find(filter)
    .populate('customerId', 'shopName ownerName customerCode')
    .populate('collectedBy', 'name code')
    .sort({ createdAt: -1 });

  const totalAmount = payments.reduce((sum, p) => sum + (p.status === 'COMPLETED' ? p.amount : 0), 0);

  return { totalAmount, count: payments.length, payments };
}

export async function getEmployeeCollectionReport({ startDate, endDate }) {
  const filter = { status: 'COMPLETED' };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const payments = await Payment.find(filter).populate('collectedBy', 'name code role');

  const report = {};
  for (const p of payments) {
    const id = p.collectedBy?._id?.toString() || 'unknown';
    if (!report[id]) {
      report[id] = {
        employee: p.collectedBy,
        totalCollected: 0,
        transactionCount: 0,
        settledAmount: 0,
        unsettledAmount: 0,
      };
    }
    report[id].totalCollected += p.amount;
    report[id].transactionCount += 1;
    if (p.settled) {
      report[id].settledAmount += p.amount;
    } else {
      report[id].unsettledAmount += p.amount;
    }
  }

  return Object.values(report);
}

export async function getCustomerOutstandingReport() {
  const customers = await Customer.find({ currentOutstanding: { $gt: 0 } })
    .sort({ currentOutstanding: -1 });

  const totalOutstanding = customers.reduce((sum, c) => sum + c.currentOutstanding, 0);

  return { totalOutstanding, customerCount: customers.length, customers };
}

export async function getSettlementReport({ startDate, endDate, employeeId, status }) {
  const filter = {};
  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;

  if (startDate || endDate) {
    filter.settlementDate = {};
    if (startDate) filter.settlementDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.settlementDate.$lte = end;
    }
  }

  const settlements = await Settlement.find(filter)
    .populate('employeeId', 'name code')
    .populate('settledBy', 'name code')
    .sort({ settlementDate: -1 });

  const totalExpected = settlements.reduce((sum, s) => sum + s.expectedAmount, 0);
  const totalReceived = settlements.reduce((sum, s) => sum + s.receivedAmount, 0);
  const totalDifference = totalReceived - totalExpected;

  return { totalExpected, totalReceived, totalDifference, count: settlements.length, settlements };
}

export async function getShortageReport() {
  const shortages = await Settlement.find({
    $or: [{ status: 'SHORTAGE' }, { difference: { $lt: 0 } }],
  })
    .populate('employeeId', 'name code')
    .populate('settledBy', 'name code')
    .sort({ settlementDate: -1 });

  const totalShortageAmount = shortages.reduce((sum, s) => sum + Math.abs(s.difference), 0);

  return { totalShortageAmount, count: shortages.length, shortages };
}
