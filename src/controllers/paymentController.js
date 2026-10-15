import * as paymentService from '../services/paymentService.js';
import * as correctionService from '../services/correctionService.js';
import { successResponse } from '../utils/response.js';

export async function createPayment(req, res, next) {
  try {
    const { customerId, amount, paymentMode, location, idempotencyKey } = req.body;
    const result = await paymentService.createPayment({
      customerId,
      amount,
      paymentMode,
      location,
      idempotencyKey,
      collector: req.user,
    });

    return successResponse(
      res,
      {
        payment: result.payment,
        isDuplicate: result.isDuplicate,
      },
      201,
      'Payment confirmed and recorded successfully'
    );
  } catch (error) {
    next(error);
  }
}

export async function getPayments(req, res, next) {
  try {
    const { customerId, employeeId, status, startDate, endDate, page, limit } = req.query;

    // Cash Collector can only view their own payments if employeeId is queried or filtered
    let targetEmployeeId = employeeId;
    if (req.user.role === 'CASH_COLLECTOR') {
      targetEmployeeId = req.user._id;
    }

    const result = await paymentService.getPayments({
      customerId,
      employeeId: targetEmployeeId,
      status,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getPaymentById(req, res, next) {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    return successResponse(res, { payment });
  } catch (error) {
    next(error);
  }
}

export async function getCollectorTodaySummary(req, res, next) {
  try {
    const summary = await paymentService.getCollectorTodaySummary(req.user._id);
    return successResponse(res, summary);
  } catch (error) {
    next(error);
  }
}

export async function requestCorrection(req, res, next) {
  try {
    const { requestedAmount, reason } = req.body;
    const correction = await correctionService.requestPaymentCorrection({
      paymentId: req.params.id,
      requestedAmount,
      reason,
      user: req.user,
    });

    return successResponse(res, { correction }, 201, 'Payment correction request submitted');
  } catch (error) {
    next(error);
  }
}
