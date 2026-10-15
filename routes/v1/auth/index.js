import express from 'express';
import * as authController from '../../../components/auth/auth.controller.js';
import { validate } from '../../../common/middlewares/validation.js';
import { loginSchema } from '../../../components/auth/auth.helper.js';
import { authenticate } from '../../../common/middlewares/authentication.js';

const router = express.Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;
