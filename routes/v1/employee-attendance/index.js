import express from 'express';
import * as attendanceController from '../../../components/employee-attendance/employee-attendance.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

router.post('/sign-in', attendanceController.signIn);
router.post('/sign-out', attendanceController.signOut);
router.get('/today', attendanceController.getTodaySession);
router.get('/history', attendanceController.getHistory);
router.get('/:id', attendanceController.getById);

export default router;
