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

    // Owner and Admin can collect without employee daily attendance restriction if needed
    if (req.user.role === ROLES.OWNER || req.user.role === ROLES.ADMIN) {
      return next();
    }

    // For CASH_COLLECTOR (and STAFF if collecting), an ACTIVE session is strictly required
    const activeSession = await EmployeeAttendance.findOne({
      employeeId: req.user._id,
      status: ATTENDANCE_STATUS.ACTIVE,
    });

    if (!activeSession) {
      return next(
        new ApiError(
          403,
          'You are not signed in. An active daily work session is required before collecting payments. Please click SIGN IN.'
        )
      );
    }

    // Attach active workSession to request
    req.activeWorkSession = activeSession;
    next();
  } catch (err) {
    next(err);
  }
};
