import express from 'express';
import * as auditController from '../../../components/audit-log/audit-log.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(ROLES.OWNER, ROLES.ADMIN), auditController.getAuditLogs);

export default router;
