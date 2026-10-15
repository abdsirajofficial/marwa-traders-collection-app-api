import * as reportService from '../services/reportService.js';
import { successResponse } from '../utils/response.js';

export async function getDashboard(req, res, next) {
  try {
    const data = await reportService.getDashboardMetrics();
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getCollectionsReport(req, res, next) {
  try {
    const { startDate, endDate, employeeId, customerId, status } = req.query;
    const data = await reportService.getCollectionReport({
      startDate,
      endDate,
      employeeId,
      customerId,
      status,
    });
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getOutstandingReport(req, res, next) {
  try {
    const data = await reportService.getCustomerOutstandingReport();
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getSettlementsReport(req, res, next) {
  try {
    const { startDate, endDate, employeeId, status } = req.query;
    const data = await reportService.getSettlementReport({
      startDate,
      endDate,
      employeeId,
      status,
    });
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getShortagesReport(req, res, next) {
  try {
    const data = await reportService.getShortageReport();
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeCollectionsReport(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportService.getEmployeeCollectionReport({ startDate, endDate });
    return successResponse(res, data);
  } catch (error) {
    next(error);
  }
}
