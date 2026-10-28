import express from 'express';
import * as invoiceController from '../../../components/invoice/invoice.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/', invoiceController.getInvoices);
router.post('/', authorize(ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF), invoiceController.createInvoice);
router.get('/:id', invoiceController.getInvoiceById);
router.put('/:id', authorize(ROLES.OWNER), invoiceController.updateInvoice);
router.patch('/:id', authorize(ROLES.OWNER), invoiceController.updateInvoice);

export default router;
