import * as paymentService from './payment.service.js';
import * as correctionService from '../settlement/settlement.service.js'; // or correction service
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const createPayment = catchAsync(async (req, res) => {
  const { customerId, amount, paymentMode, location, idempotencyKey } = req.body;
  const result = await paymentService.createPayment({
    customerId,
    amount,
    paymentMode,
    location,
    idempotencyKey,
    collector: req.user,
    ipAddress: req.ip,
  });

  return sendResponse(
    res,
    'Payment confirmed and recorded successfully',
    {
      payment: result.payment,
      isDuplicate: result.isDuplicate,
    },
    201
  );
});

export const getPayments = catchAsync(async (req, res) => {
  const { customerId, employeeId, workSessionId, status, startDate, endDate, page, limit } = req.query;

  let targetEmployeeId = employeeId;
  if (req.user.role === 'CASH_COLLECTOR') {
    targetEmployeeId = req.user._id;
  }

  const result = await paymentService.getPayments({
    customerId,
    employeeId: targetEmployeeId,
    workSessionId,
    status,
    startDate,
    endDate,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 50,
  });

  return sendResponse(res, 'Payments retrieved successfully', result);
});

export const getPaymentById = catchAsync(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id);
  return sendResponse(res, 'Payment details retrieved', { payment });
});

export const getCollectorToday = catchAsync(async (req, res) => {
  const summary = await paymentService.getCollectorTodaySummary(req.user._id);
  return sendResponse(res, 'Today collection summary', summary);
});

export const getPaymentByReceipt = catchAsync(async (req, res) => {
  const payment = await paymentService.getPaymentByReceiptNumber(req.params.receiptNumber);
  return sendResponse(res, 'Payment details retrieved', { payment });
});

export const requestCorrection = catchAsync(async (req, res) => {
  const { requestedAmount, reason } = req.body;
  const correction = await correctionService.requestPaymentCorrection({
    paymentId: req.params.id,
    requestedAmount,
    reason,
    user: req.user,
    ipAddress: req.ip,
  });
  return sendResponse(res, 'Correction request submitted', { correction }, 201);
});

export const decideCorrection = catchAsync(async (req, res) => {
  const { status, reviewNotes } = req.body;
  const result = await correctionService.reviewPaymentCorrection({
    correctionId: req.params.correctionId,
    status,
    reviewNotes,
    reviewer: req.user,
    ipAddress: req.ip,
  });
  return sendResponse(res, `Correction request ${status.toLowerCase()}`, result);
});

