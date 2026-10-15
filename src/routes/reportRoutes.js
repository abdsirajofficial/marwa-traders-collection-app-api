import express from 'express';
import {
  getDashboard,
  getCollectionsReport,
  getOutstandingReport,
  getSettlementsReport,
  getShortagesReport,
  getEmployeeCollectionsReport,
} from '../controllers/reportController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/dashboard', requireRole('OWNER', 'ADMIN'), getDashboard);
router.get('/collections', requireRole('OWNER', 'ADMIN'), getCollectionsReport);
router.get('/outstanding', requireRole('OWNER', 'ADMIN'), getOutstandingReport);
router.get('/settlements', requireRole('OWNER', 'ADMIN'), getSettlementsReport);
router.get('/shortages', requireRole('OWNER', 'ADMIN'), getShortagesReport);
router.get('/employees', requireRole('OWNER', 'ADMIN'), getEmployeeCollectionsReport);

export default router;
