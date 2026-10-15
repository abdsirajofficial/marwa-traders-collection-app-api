import * as userService from './user.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const getUsers = catchAsync(async (req, res) => {
  const users = await userService.getUsers(req.query.role);
  return sendResponse(res, 'Users retrieved successfully', { users });
});

export const getCollectors = catchAsync(async (req, res) => {
  const collectors = await userService.getCollectors();
  return sendResponse(res, 'Collectors retrieved successfully', { collectors });
});

export const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body, req.user);
  return sendResponse(res, 'User created successfully', { user }, 201);
});

export const updateUserStatus = catchAsync(async (req, res) => {
  const user = await userService.updateUserStatus(req.params.id, req.body.isActive, req.user);
  return sendResponse(res, 'User status updated successfully', { user });
});

export const updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  return sendResponse(res, 'User updated successfully', { user });
});

export const deleteUser = catchAsync(async (req, res) => {
  const user = await userService.deleteUser(req.params.id, req.user);
  return sendResponse(res, 'User deleted successfully', { user });
});

export const resetUserPin = catchAsync(async (req, res) => {
  const user = await userService.resetUserPin(req.params.id, req.user);
  return sendResponse(res, 'User PIN reset successfully', { user });
});

