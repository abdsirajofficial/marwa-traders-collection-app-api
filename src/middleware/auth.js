import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { errorResponse } from '../utils/response.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authentication required. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return errorResponse(res, 'User not found or inactive.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Session token expired. Please login again.', 401);
    }
    return errorResponse(res, 'Invalid token.', 401);
  }
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, `Forbidden: ${req.user.role} role does not have permission for this action.`, 403);
    }

    next();
  };
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', 401);
    }

    // OWNER has all permissions
    if (req.user.role === 'OWNER') {
      return next();
    }

    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }

    return errorResponse(res, `Forbidden: Missing required permission [${permission}].`, 403);
  };
};
