import * as invoiceService from './invoice.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const getInvoices = catchAsync(async (req, res) => {
  const { customerId, status, page, limit } = req.query;
  const result = await invoiceService.getInvoices({
    customerId,
    status,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  return sendResponse(res, 'Invoices retrieved successfully', result);
});

export const getInvoiceById = catchAsync(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  return sendResponse(res, 'Invoice details retrieved', { invoice });
});

export const createInvoice = catchAsync(async (req, res) => {
  const invoice = await invoiceService.createInvoice(req.body, req.user, req.ip);
  return sendResponse(res, 'Invoice created successfully', { invoice }, 201);
});
