import express from 'express';
import * as reportController from '../../../components/report/report.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/dashboard', authorize(ROLES.OWNER, ROLES.ADMIN), reportController.getDashboard);
router.get('/collections', authorize(ROLES.OWNER, ROLES.ADMIN), reportController.getCollectionsReport);
router.get('/outstanding', authorize(ROLES.OWNER, ROLES.ADMIN), reportController.getOutstandingReport);
router.get('/settlements', authorize(ROLES.OWNER, ROLES.ADMIN), reportController.getSettlementsReport);
router.get('/shortages', authorize(ROLES.OWNER, ROLES.ADMIN), reportController.getShortagesReport);
router.get('/employees', authorize(ROLES.OWNER, ROLES.ADMIN), reportController.getEmployeeCollectionsReport);

export default router;
