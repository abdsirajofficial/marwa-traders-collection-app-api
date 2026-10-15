import * as reportService from './report.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const getDashboard = catchAsync(async (req, res) => {
  const data = await reportService.getDashboardMetrics();
  return sendResponse(res, 'Dashboard metrics retrieved', data);
});

export const getCollectionsReport = catchAsync(async (req, res) => {
  const { startDate, endDate, employeeId, customerId, status } = req.query;
  const data = await reportService.getCollectionReport({ startDate, endDate, employeeId, customerId, status });
  return sendResponse(res, 'Collections report generated', data);
});

export const getOutstandingReport = catchAsync(async (req, res) => {
  const data = await reportService.getCustomerOutstandingReport();
  return sendResponse(res, 'Customer outstanding report generated', data);
});

export const getSettlementsReport = catchAsync(async (req, res) => {
  const { startDate, endDate, employeeId, status } = req.query;
  const data = await reportService.getSettlementReport({ startDate, endDate, employeeId, status });
  return sendResponse(res, 'Settlement report generated', data);
});

export const getShortagesReport = catchAsync(async (req, res) => {
  const data = await reportService.getShortageReport();
  return sendResponse(res, 'Shortages report generated', data);
});

export const getEmployeeCollectionsReport = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await reportService.getEmployeeCollectionReport({ startDate, endDate });
  return sendResponse(res, 'Employee collections report generated', data);
});
