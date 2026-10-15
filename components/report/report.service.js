import { Payment } from '../payment/payment.model.js';
import { Customer } from '../customer/customer.model.js';
import { Settlement } from '../settlement/settlement.model.js';
import { EmployeeAttendance } from '../employee-attendance/employee-attendance.model.js';
import { getTodayDateString } from '../employee-attendance/employee-attendance.helper.js';

export const getDashboardMetrics = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Today's payments
  const todayPayments = await Payment.find({
    status: 'COMPLETED',
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  }).populate('collectedBy', 'name code');

  const todayTotalCollection = todayPayments.reduce((sum, p) => sum + p.amount, 0);
  const todayTransactions = todayPayments.length;
  const todayCash = todayTotalCollection;

  // 2. Settlement status
  const settledPayments = todayPayments.filter((p) => p.settled);
  const settledAmount = settledPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingSettlement = todayTotalCollection - settledAmount;

  // 3. Today Shortages
  const todaySettlements = await Settlement.find({
    settlementDate: { $gte: startOfDay, $lte: endOfDay },
  });
  const todayShortage = todaySettlements.reduce((sum, s) => {
    return s.difference < 0 ? sum + Math.abs(s.difference) : sum;
  }, 0);

  // 4. Customer Outstanding total
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

  // 6. Today's Employee Attendance & Work Sessions (Part 32)
  const rawAttendance = await EmployeeAttendance.find({
    date: getTodayDateString(),
  })
    .populate('employeeId', 'name code phone')
    .sort({ signInTime: -1 });

  // Compute real-time collections and total cash for every session (both active and completed)
  const todayAttendance = rawAttendance.map((att) => {
    const doc = att.toObject();
    const sessionPayments = todayPayments.filter((p) => {
      if (doc.workSessionId && p.workSessionId) {
        return p.workSessionId === doc.workSessionId;
      }
      const pEmpId = p.collectedBy?._id?.toString() || p.collectedBy?.toString();
      const aEmpId = doc.employeeId?._id?.toString() || doc.employeeId?.toString();
      return pEmpId && aEmpId && pEmpId === aEmpId;
    });

    const liveCount = sessionPayments.length;
    const liveCollected = sessionPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      ...doc,
      employeeName: doc.employeeId?.name || doc.employeeName,
      totalTransactions: liveCount > 0 ? liveCount : (doc.totalTransactions || 0),
      totalCollected: liveCollected > 0 ? liveCollected : (doc.totalCollected || 0),
    };
  });

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
    todayAttendance,
  };
};

export const getCollectionReport = async ({ startDate, endDate, employeeId, customerId, status }) => {
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
};

export const getEmployeeCollectionReport = async ({ startDate, endDate }) => {
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
};

export const getCustomerOutstandingReport = async () => {
  const customers = await Customer.find({ currentOutstanding: { $gt: 0 } }).sort({ currentOutstanding: -1 });
  const totalOutstanding = customers.reduce((sum, c) => sum + c.currentOutstanding, 0);
  return { totalOutstanding, customerCount: customers.length, customers };
};

export const getSettlementReport = async ({ startDate, endDate, employeeId, status }) => {
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
};

export const getShortageReport = async () => {
  const shortages = await Settlement.find({
    $or: [{ status: 'SHORTAGE' }, { difference: { $lt: 0 } }],
  })
    .populate('employeeId', 'name code')
    .populate('settledBy', 'name code')
    .sort({ settlementDate: -1 });

  const totalShortageAmount = shortages.reduce((sum, s) => sum + Math.abs(s.difference), 0);
  return { totalShortageAmount, count: shortages.length, shortages };
};
