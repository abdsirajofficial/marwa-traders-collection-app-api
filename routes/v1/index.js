import express from 'express';
import authRoutes from './auth/index.js';
import userRoutes from './user/index.js';
import customerRoutes from './customer/index.js';
import invoiceRoutes from './invoice/index.js';
import paymentRoutes from './payment/index.js';
import collectionRoutes from './collection/index.js';
import settlementRoutes from './settlement/index.js';
import attendanceRoutes from './employee-attendance/index.js';
import reportRoutes from './report/index.js';
import auditLogRoutes from './audit-log/index.js';
import whatsappRoutes from './whatsapp/index.js';
import correctionRoutes from './correction/index.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/users', userRoutes); // alias for backwards compatibility
router.use('/customer', customerRoutes);
router.use('/customers', customerRoutes); // alias for backwards compatibility
router.use('/invoice', invoiceRoutes);
router.use('/invoices', invoiceRoutes); // alias for backwards compatibility
router.use('/payment', paymentRoutes);
router.use('/payments', paymentRoutes); // alias for backwards compatibility
router.use('/collection', collectionRoutes);
router.use('/collections', collectionRoutes); // alias for backwards compatibility
router.use('/settlement', settlementRoutes);
router.use('/settlements', settlementRoutes); // alias for backwards compatibility
router.use('/correction', correctionRoutes);
router.use('/corrections', correctionRoutes); // alias for backwards compatibility
router.use('/employee-attendance', attendanceRoutes);
router.use('/attendance', attendanceRoutes); // alias
router.use('/report', reportRoutes);
router.use('/reports', reportRoutes); // alias
router.use('/audit-log', auditLogRoutes);
router.use('/audit', auditLogRoutes); // alias
router.use('/whatsapp', whatsappRoutes);

export default router;
