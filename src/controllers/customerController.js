import * as customerService from '../services/customerService.js';
import { successResponse } from '../utils/response.js';

export async function getCustomers(req, res, next) {
  try {
    const { search, page, limit } = req.query;
    const result = await customerService.searchCustomers(
      search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getCustomerById(req, res, next) {
  try {
    const result = await customerService.getCustomerById(req.params.id);
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.body, req.user);
    return successResponse(res, { customer }, 201, 'Customer created successfully');
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req, res, next) {
  try {
    const customer = await customerService.updateCustomer(req.params.id, req.body, req.user);
    return successResponse(res, { customer }, 200, 'Customer updated successfully');
  } catch (error) {
    next(error);
  }
}
