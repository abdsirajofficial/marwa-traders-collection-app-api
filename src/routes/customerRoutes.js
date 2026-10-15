import express from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
} from '../controllers/customerController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateRequest, customerCreateSchema, customerUpdateSchema } from '../validators/schemas.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', requireRole('OWNER', 'ADMIN', 'STAFF'), validateRequest(customerCreateSchema), createCustomer);
router.put('/:id', requireRole('OWNER', 'ADMIN', 'STAFF'), validateRequest(customerUpdateSchema), updateCustomer);

export default router;
