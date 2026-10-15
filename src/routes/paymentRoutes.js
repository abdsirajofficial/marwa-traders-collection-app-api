import express from 'express';
import {
  createPayment,
  getPayments,
  getPaymentById,
  getCollectorTodaySummary,
  requestCorrection,
} from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest, paymentCreateSchema, correctionRequestSchema } from '../validators/schemas.js';

const router = express.Router();

router.use(authenticate);

// List and collector endpoints
router.get('/', getPayments);
router.get('/collector/today', getCollectorTodaySummary);
router.get('/:id', getPaymentById);

// Create payment - append-only, immutable!
router.post('/', validateRequest(paymentCreateSchema), createPayment);

// Correction request - does not modify payment, creates a pending correction
router.post('/:id/correction-request', validateRequest(correctionRequestSchema), requestCorrection);

// Note: No DELETE or PUT/PATCH endpoints exist by design to maintain financial immutability

export default router;
