import mongoose from 'mongoose';
import { ATTENDANCE_STATUS } from '../../common/utils/constants.js';

const employeeAttendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true,
    },
    workSessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    signInTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    signInLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      address: { type: String, default: null },
    },
    signOutTime: {
      type: Date,
      default: null,
    },
    signOutLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      address: { type: String, default: null },
    },
    totalTransactions: {
      type: Number,
      default: 0,
    },
    totalCollected: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

employeeAttendanceSchema.index({ employeeId: 1, date: 1 });
employeeAttendanceSchema.index({ employeeId: 1, status: 1 });

export const EmployeeAttendance = mongoose.model('EmployeeAttendance', employeeAttendanceSchema);
