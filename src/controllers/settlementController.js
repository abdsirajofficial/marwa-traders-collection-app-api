import * as settlementService from '../services/settlementService.js';
import { successResponse } from '../utils/response.js';

export async function getExpectedCash(req, res, next) {
  try {
    const data = await settlementService.getEmployeeExpectedCash(req.params.employeeId);
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createSettlement(req, res, next) {
  try {
    const { employeeId, receivedAmount, notes } = req.body;
    const settlement = await settlementService.createSettlement({
      employeeId,
      receivedAmount,
      notes,
      settledBy: req.user,
    });
    return successResponse(res, { settlement }, 201, 'Cash settlement recorded successfully');
  } catch (error) {
    next(error);
  }
}

export async function getSettlements(req, res, next) {
  try {
    const { employeeId, status, page, limit } = req.query;
    const result = await settlementService.getSettlements({
      employeeId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getSettlementById(req, res, next) {
  try {
    const settlement = await settlementService.getSettlementById(req.params.id);
    return successResponse(res, { settlement });
  } catch (error) {
    next(error);
  }
}
