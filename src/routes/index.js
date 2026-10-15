import express from 'express';
import authRoutes from './authRoutes.js';
import customerRoutes from './customerRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import settlementRoutes from './settlementRoutes.js';
import correctionRoutes from './correctionRoutes.js';
import reportRoutes from './reportRoutes.js';
import auditRoutes from './auditRoutes.js';
import userRoutes from './userRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/settlements', settlementRoutes);
router.use('/corrections', correctionRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/users', userRoutes);

export default router;
