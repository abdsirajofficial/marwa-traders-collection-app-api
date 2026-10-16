import * as authService from './auth.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const login = catchAsync(async (req, res) => {
  const client = req.body.client || req.headers['x-client-app'];
  const result = await authService.loginWithCode(req.body.code, req.ip, client);
  return sendResponse(res, 'Login successful', result);
});

export const logout = catchAsync(async (req, res) => {
  await authService.logoutUser(req.user, req.ip);
  return sendResponse(res, 'Logged out successfully', null);
});

export const getMe = catchAsync(async (req, res) => {
  return sendResponse(res, 'Current user profile', {
    user: {
      id: req.user._id,
      code: req.user.code,
      name: req.user.name,
      role: req.user.role,
      permissions: req.user.permissions,
    },
  });
});
