import express from 'express';
import * as whatsappController from '../../../components/whatsapp/whatsapp.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/logs', authorize(ROLES.OWNER, ROLES.ADMIN), whatsappController.getNotificationLogs);
router.post('/logs/:id/retry', authorize(ROLES.OWNER, ROLES.ADMIN), whatsappController.retryNotification);

export default router;
