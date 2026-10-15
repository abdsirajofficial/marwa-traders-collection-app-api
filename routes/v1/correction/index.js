import express from 'express';
import * as settlementController from '../../../components/settlement/settlement.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

// Owner and Admin can view corrections
router.get('/', authorize(ROLES.OWNER, ROLES.ADMIN), settlementController.getCorrections);

// Reviewing and deciding corrections is allowed for Owner and Admin
router.post('/:id/review', authorize(ROLES.OWNER, ROLES.ADMIN), settlementController.reviewCorrection);

export default router;
