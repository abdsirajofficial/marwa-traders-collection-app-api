import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('OWNER'));

router.get('/', getAuditLogs);

export default router;
