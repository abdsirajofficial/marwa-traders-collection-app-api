import express from 'express';
import {
  createSettlement,
  getSettlements,
  getSettlementById,
  getExpectedCash,
} from '../controllers/settlementController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateRequest, settlementCreateSchema } from '../validators/schemas.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('OWNER', 'ADMIN'));

router.get('/', getSettlements);
router.get('/expected/:employeeId', getExpectedCash);
router.get('/:id', getSettlementById);
router.post('/', validateRequest(settlementCreateSchema), createSettlement);

export default router;
