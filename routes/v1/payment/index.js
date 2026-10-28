import express from 'express';
import * as paymentController from '../../../components/payment/payment.controller.js';
import { authenticate, authorize, requireActiveWorkSession } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

// Creation requires active work session for cash collectors (handled in middleware and service)
router.post('/', requireActiveWorkSession, paymentController.createPayment);
router.get('/collector/today', paymentController.getCollectorToday);
router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPaymentById);
router.put('/:id', authorize(ROLES.OWNER), paymentController.updatePayment);
router.patch('/:id', authorize(ROLES.OWNER), paymentController.updatePayment);
router.get('/receipt/:receiptNumber', paymentController.getPaymentByReceipt);
router.post('/:id/correction', authorize(ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF), paymentController.requestCorrection);
router.post('/correction/:correctionId/decide', authorize(ROLES.OWNER), paymentController.decideCorrection);

export default router;
