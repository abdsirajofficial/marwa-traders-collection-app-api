import * as attendanceService from './employee-attendance.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const signIn = catchAsync(async (req, res) => {
  const session = await attendanceService.signIn(req.user._id, req.body.location, req.ip);
  return sendResponse(res, 'Employee signed in successfully', { session }, 201);
});

export const signOut = catchAsync(async (req, res) => {
  const result = await attendanceService.signOut(
    req.user._id,
    req.body.workSessionId,
    req.body.location,
    req.ip
  );
  return sendResponse(res, 'Employee signed out successfully', result);
});

export const getTodaySession = catchAsync(async (req, res) => {
  const session = await attendanceService.getTodaySession(req.user._id);
  return sendResponse(res, 'Today session retrieved', { session });
});

export const getHistory = catchAsync(async (req, res) => {
  const employeeId = req.user.role === 'CASH_COLLECTOR' ? req.user._id : req.query.employeeId;
  const result = await attendanceService.getAttendanceList({
    date: req.query.date,
    employeeId,
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
  });
  return sendResponse(res, 'Attendance history retrieved', result);
});

export const getById = catchAsync(async (req, res) => {
  const session = await attendanceService.getAttendanceById(req.params.id);
  return sendResponse(res, 'Attendance session retrieved', { session });
});

