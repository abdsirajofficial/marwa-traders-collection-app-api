import * as customerService from './customer.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const getCustomers = catchAsync(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await customerService.searchCustomers(
    search,
    page ? parseInt(page, 10) : 1,
    limit ? parseInt(limit, 10) : 50
  );
  return sendResponse(res, 'Customers retrieved successfully', result);
});

export const getCustomerById = catchAsync(async (req, res) => {
  const result = await customerService.getCustomerById(req.params.id);
  return sendResponse(res, 'Customer details retrieved', result);
});

export const createCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.createCustomer(req.body, req.user, req.ip);
  return sendResponse(res, 'Customer created successfully', { customer }, 201);
});

export const updateCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body, req.user, req.ip);
  return sendResponse(res, 'Customer updated successfully', { customer });
});
