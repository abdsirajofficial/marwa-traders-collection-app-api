import express from 'express';
import { login, logout, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validateRequest, loginSchema } from '../validators/schemas.js';

const router = express.Router();

router.post('/login', authLimiter, validateRequest(loginSchema), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;
