import * as invoiceService from '../services/invoiceService.js';
import { successResponse } from '../utils/response.js';

export async function getInvoices(req, res, next) {
  try {
    const { customerId, status, page, limit } = req.query;
    const result = await invoiceService.getInvoices({
      customerId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getInvoiceById(req, res, next) {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    return successResponse(res, { invoice });
  } catch (error) {
    next(error);
  }
}

export async function createInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.createInvoice(req.body, req.user);
    return successResponse(res, { invoice }, 201, 'Invoice created successfully');
  } catch (error) {
    next(error);
  }
}
