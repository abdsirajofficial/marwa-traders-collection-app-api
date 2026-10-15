import express from 'express';
import * as settlementController from '../../../components/settlement/settlement.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/expected/:employeeId', authorize(ROLES.OWNER, ROLES.ADMIN), settlementController.getExpectedCash);
router.post('/', authorize(ROLES.OWNER, ROLES.ADMIN), settlementController.createSettlement);
router.get('/', authorize(ROLES.OWNER, ROLES.ADMIN), settlementController.getSettlements);
router.get('/corrections', authorize(ROLES.OWNER, ROLES.ADMIN), settlementController.getCorrections);
router.post('/corrections/:id/review', authorize(ROLES.OWNER), settlementController.reviewCorrection);
router.get('/:id', authorize(ROLES.OWNER, ROLES.ADMIN), settlementController.getSettlementById);

export default router;
