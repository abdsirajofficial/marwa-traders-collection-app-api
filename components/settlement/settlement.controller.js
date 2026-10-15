import * as settlementService from './settlement.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const getExpectedCash = catchAsync(async (req, res) => {
  const data = await settlementService.getEmployeeExpectedCash(req.params.employeeId);
  return sendResponse(res, 'Expected cash calculated', data);
});

export const createSettlement = catchAsync(async (req, res) => {
  const { employeeId, receivedAmount, notes } = req.body;
  const settlement = await settlementService.createSettlement({
    employeeId,
    receivedAmount,
    notes,
    settledBy: req.user,
    ipAddress: req.ip,
  });
  return sendResponse(res, 'Cash settlement recorded successfully', { settlement }, 201);
});

export const getSettlements = catchAsync(async (req, res) => {
  const { employeeId, status, page, limit } = req.query;
  const result = await settlementService.getSettlements({
    employeeId,
    status,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  return sendResponse(res, 'Settlements retrieved successfully', result);
});

export const getSettlementById = catchAsync(async (req, res) => {
  const settlement = await settlementService.getSettlementById(req.params.id);
  return sendResponse(res, 'Settlement details retrieved', { settlement });
});

export const requestCorrection = catchAsync(async (req, res) => {
  const { requestedAmount, reason } = req.body;
  const correction = await settlementService.requestPaymentCorrection({
    paymentId: req.params.id,
    requestedAmount,
    reason,
    user: req.user,
    ipAddress: req.ip,
  });
  return sendResponse(res, 'Correction request submitted', { correction }, 201);
});

export const getCorrections = catchAsync(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await settlementService.getCorrections({
    status,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  return sendResponse(res, 'Corrections retrieved successfully', result);
});

export const reviewCorrection = catchAsync(async (req, res) => {
  const { status, reviewNotes } = req.body;
  const result = await settlementService.reviewPaymentCorrection({
    correctionId: req.params.id,
    status,
    reviewNotes,
    reviewer: req.user,
    ipAddress: req.ip,
  });
  return sendResponse(res, `Correction request ${status.toLowerCase()}`, result);
});
