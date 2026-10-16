import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../../components/user/user.model.js';
import { EmployeeAttendance } from '../../components/employee-attendance/employee-attendance.model.js';
import { ApiError } from '../utils/api-error.util.js';
import { ROLES, ATTENDANCE_STATUS } from '../utils/constants.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required. No token provided.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive || user.isRemoved) {
      throw new ApiError(401, 'User account not found or inactive.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Session token expired. Please login again.'));
    }
    if (error instanceof ApiError) {
      return next(error);
    }
    return next(new ApiError(401, 'Invalid authentication token.'));
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Forbidden: ${req.user.role} role does not have permission for this action.`));
    }

    next();
  };
};

export const authorize = authorizeRoles;


/**
 * Section 13 & 35: Verify that a Cash Collector has an ACTIVE work session before collection!
 */
export const requireActiveWorkSession = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    // Only OWNER and CASH_COLLECTOR are authorized to collect money from shops
    if (req.user.role !== ROLES.OWNER && req.user.role !== ROLES.CASH_COLLECTOR) {
      return next(
        new ApiError(
          403,
          'Unauthorized: Only Owner and Cash Collectors are authorized to collect money from shops.'
        )
      );
    }

    // Check if user has an active work session (e.g. signed in on mobile)
    const activeSession = await EmployeeAttendance.findOne({
      employeeId: req.user._id,
      status: ATTENDANCE_STATUS.ACTIVE,
    });

    if (activeSession) {
      req.activeWorkSession = activeSession;
      return next();
    }

    // Owner can collect directly without mandatory daily attendance restriction if needed
    if (req.user.role === ROLES.OWNER) {
      return next();
    }

    return next(
      new ApiError(
        403,
        'You are not signed in. An active daily work session is required before collecting payments. Please click SIGN IN.'
      )
    );
  } catch (err) {
    next(err);
  }
};
