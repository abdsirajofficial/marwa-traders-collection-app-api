import express from 'express';
import * as customerController from '../../../components/customer/customer.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/', customerController.getCustomers);
router.post('/', authorize(ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF), customerController.createCustomer);
router.get('/:id', customerController.getCustomerById);
router.get('/:id/ledger', customerController.getCustomerById);
router.get('/:id/invoices', customerController.getCustomerById);
router.put('/:id', authorize(ROLES.OWNER), customerController.updateCustomer);
router.patch('/:id', authorize(ROLES.OWNER), customerController.updateCustomer);

export default router;
