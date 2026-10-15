import express from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
} from '../controllers/invoiceController.js';
import { authenticate, requireRole, requirePermission } from '../middleware/auth.js';
import { validateRequest, invoiceCreateSchema } from '../validators/schemas.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post(
  '/',
  (req, res, next) => {
    // If user is OWNER, ADMIN, or STAFF, proceed directly
    if (['OWNER', 'ADMIN', 'STAFF'].includes(req.user.role)) {
      return next();
    }
    return requireRole('OWNER', 'ADMIN', 'STAFF')(req, res, next);
  },
  validateRequest(invoiceCreateSchema),
  createInvoice
);

export default router;
