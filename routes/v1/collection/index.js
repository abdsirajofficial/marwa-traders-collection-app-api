import express from 'express';
import * as collectionController from '../../../components/collection/collection.controller.js';
import { authenticate, authorize, requireActiveWorkSession } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

// Creation requires active work session for cash collectors
router.post('/', requireActiveWorkSession, collectionController.createPayment);
router.get('/collector/today', collectionController.getCollectorToday);
router.get('/', collectionController.getPayments);
router.get('/:id', collectionController.getPaymentById);
router.get('/receipt/:receiptNumber', collectionController.getPaymentByReceipt);
router.post('/:id/correction', authorize(ROLES.OWNER, ROLES.ADMIN, ROLES.STAFF), collectionController.requestCorrection);
router.post('/correction/:correctionId/decide', authorize(ROLES.OWNER), collectionController.decideCorrection);

export default router;
