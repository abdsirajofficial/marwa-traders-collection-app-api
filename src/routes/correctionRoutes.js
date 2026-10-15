import express from 'express';
import { getCorrections, reviewCorrection } from '../controllers/correctionController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateRequest, correctionReviewSchema } from '../validators/schemas.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('OWNER', 'ADMIN'));

router.get('/', getCorrections);
router.post('/:id/review', validateRequest(correctionReviewSchema), reviewCorrection);

export default router;
