import express from 'express';
import { getUsers, createUser, getCollectors } from '../controllers/userController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Collectors list can be read by Owner/Admin (e.g. for settlement screen)
router.get('/collectors', requireRole('OWNER', 'ADMIN'), getCollectors);

// Full user management accessible by Owner and Admin (with role hierarchy in controller)
router.get('/', requireRole('OWNER', 'ADMIN'), getUsers);
router.post('/', requireRole('OWNER', 'ADMIN'), createUser);
router.put('/:id', requireRole('OWNER', 'ADMIN'), updateUser);
router.patch('/:id', requireRole('OWNER', 'ADMIN'), updateUser);
router.delete('/:id', requireRole('OWNER', 'ADMIN'), deleteUser);

export default router;
