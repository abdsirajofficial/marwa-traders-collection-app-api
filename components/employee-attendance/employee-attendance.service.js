import { EmployeeAttendance } from './employee-attendance.model.js';
import { User } from '../user/user.model.js';
import { Payment } from '../payment/payment.model.js';
import { ApiError } from '../../common/utils/api-error.util.js';
import { logAuditEvent } from '../audit-log/audit-log.service.js';
import { NotificationService } from '../../common/service/notification.service.js';
import { generateWorkSessionId, getTodayDateString } from './employee-attendance.helper.js';
import { ATTENDANCE_STATUS, AUDIT_ACTIONS } from '../../common/utils/constants.js';

/**
 * Section 7 & 28: Employee Sign-In Service
 * NO WhatsApp is sent on Sign-In!
 */
export const signIn = async (employeeId, location = {}, ipAddress = null) => {
  const employee = await User.findById(employeeId);
  if (!employee || !employee.isActive) {
    throw new ApiError(404, 'Employee not found or inactive');
  }

  // Check if an ACTIVE work session already exists for this employee
  const existingActive = await EmployeeAttendance.findOne({
    employeeId: employee._id,
    status: ATTENDANCE_STATUS.ACTIVE,
  });

  if (existingActive) {
    throw new ApiError(
      400,
      `Employee already has an active work session (${existingActive.workSessionId}) started at ${existingActive.signInTime.toLocaleTimeString()}`
    );
  }

  const workSessionId = generateWorkSessionId();
  const dateStr = getTodayDateString();

  const session = await EmployeeAttendance.create({
    employeeId: employee._id,
    employeeName: employee.name,
    date: dateStr,
    workSessionId,
    signInTime: new Date(),
    signInLocation: {
      latitude: location.latitude !== undefined ? location.latitude : null,
      longitude: location.longitude !== undefined ? location.longitude : null,
      address: location.address || null,
    },
    status: ATTENDANCE_STATUS.ACTIVE,
    totalTransactions: 0,
    totalCollected: 0,
  });

  // Record Audit Event
  await logAuditEvent({
    userId: employee._id,
    userCode: employee.code,
    role: employee.role,
    action: AUDIT_ACTIONS.EMPLOYEE_SIGN_IN,
    entity: 'EMPLOYEE_ATTENDANCE',
    entityId: session._id.toString(),
    description: `Employee ${employee.name} (${employee.code}) signed in for daily shift. WorkSession: ${workSessionId}`,
    ipAddress,
    metadata: {
      workSessionId,
      signInTime: session.signInTime,
      signInLocation: session.signInLocation,
    },
  });

  // DO NOT send WhatsApp for sign-in (Section 10)
  return session;
};

/**
 * Section 17 & 29: Employee Sign-Out Service
 * Calculates all collections for this session and dispatches Owner Daily Report WhatsApp
 */
export const signOut = async (employeeId, workSessionId = null, location = {}, ipAddress = null) => {
  const employee = await User.findById(employeeId);
  if (!employee) {
    throw new ApiError(404, 'Employee not found');
  }

  const query = {
    employeeId: employee._id,
    status: ATTENDANCE_STATUS.ACTIVE,
  };
  if (workSessionId) {
    query.workSessionId = workSessionId;
  }

  const session = await EmployeeAttendance.findOne(query);
  if (!session) {
    throw new ApiError(404, 'No active work session found to sign out');
  }

  // Find all collections matching this workSessionId
  const collections = await Payment.find({
    collectedBy: employee._id,
    workSessionId: session.workSessionId,
    status: 'COMPLETED',
  }).populate('customerId', 'shopName address');

  const totalTransactions = collections.length;
  const totalCollected = collections.reduce((sum, c) => sum + c.amount, 0);

  // Update work session document
  session.signOutTime = new Date();
  session.signOutLocation = {
    latitude: location.latitude !== undefined ? location.latitude : null,
    longitude: location.longitude !== undefined ? location.longitude : null,
    address: location.address || null,
  };
  session.totalTransactions = totalTransactions;
  session.totalCollected = totalCollected;
  session.status = ATTENDANCE_STATUS.COMPLETED;
  await session.save();

  // Create Audit Log
  await logAuditEvent({
    userId: employee._id,
    userCode: employee.code,
    role: employee.role,
    action: AUDIT_ACTIONS.EMPLOYEE_SIGN_OUT,
    entity: 'EMPLOYEE_ATTENDANCE',
    entityId: session._id.toString(),
    description: `Employee ${employee.name} signed out. Total Collections: ${totalTransactions}, Total Cash: ₹${totalCollected}`,
    ipAddress,
    metadata: {
      workSessionId: session.workSessionId,
      totalTransactions,
      totalCollected,
      signOutLocation: session.signOutLocation,
    },
  });

  // Trigger ONE comprehensive Owner Daily WhatsApp Report (Section 21)
  // WhatsApp failure must NEVER rollback sign-out!
  NotificationService.notifyOwnerDailyReport({
    session,
    employee,
    collections,
    totalTransactions,
    totalCollected,
  }).catch((err) => {
    console.error('[EmployeeAttendanceService] Non-blocking WhatsApp report error:', err.message);
  });

  return {
    session,
    collections,
    summary: {
      employeeName: employee.name,
      workSessionId: session.workSessionId,
      signInTime: session.signInTime,
      signInLocation: session.signInLocation,
      signOutTime: session.signOutTime,
      signOutLocation: session.signOutLocation,
      totalTransactions,
      totalCollected,
      expectedCash: totalCollected,
    },
  };
};

/**
 * Returns current active session or latest today session
 */
export const getActiveSession = async (employeeId) => {
  return EmployeeAttendance.findOne({
    employeeId,
    status: ATTENDANCE_STATUS.ACTIVE,
  });
};

export const getTodaySession = async (employeeId) => {
  const dateStr = getTodayDateString();
  // Return active first, or latest for today
  let session = await EmployeeAttendance.findOne({
    employeeId,
    status: ATTENDANCE_STATUS.ACTIVE,
  });

  if (!session) {
    session = await EmployeeAttendance.findOne({
      employeeId,
      date: dateStr,
    }).sort({ createdAt: -1 });
  }

  return session;
};

/**
 * Section 32: Owner attendance view
 */
export const getAttendanceList = async ({ date, employeeId, page = 1, limit = 50 }) => {
  const filter = {};
  if (date) filter.date = date;
  if (employeeId) filter.employeeId = employeeId;

  const skip = (page - 1) * limit;
  const [sessions, total] = await Promise.all([
    EmployeeAttendance.find(filter)
      .populate('employeeId', 'name code phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    EmployeeAttendance.countDocuments(filter),
  ]);

  return { sessions, total, page, totalPages: Math.ceil(total / limit) };
};

export const getAttendanceById = async (id) => {
  const session = await EmployeeAttendance.findById(id).populate('employeeId', 'name code phone');
  if (!session) {
    throw new ApiError(404, 'Attendance session not found');
  }
  return session;
};

