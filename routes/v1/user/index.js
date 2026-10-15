import express from 'express';
import * as userController from '../../../components/user/user.controller.js';
import { authenticate, authorize } from '../../../common/middlewares/authentication.js';
import { ROLES } from '../../../common/utils/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(ROLES.OWNER, ROLES.ADMIN), userController.getUsers);
router.post('/', authorize(ROLES.OWNER, ROLES.ADMIN), userController.createUser);
router.get('/collectors', authorize(ROLES.OWNER, ROLES.ADMIN), userController.getCollectors);
router.patch('/:id/status', authorize(ROLES.OWNER, ROLES.ADMIN), userController.updateUserStatus);
router.put('/:id', authorize(ROLES.OWNER, ROLES.ADMIN), userController.updateUser);
router.patch('/:id', authorize(ROLES.OWNER, ROLES.ADMIN), userController.updateUser);
router.delete('/:id', authorize(ROLES.OWNER, ROLES.ADMIN), userController.deleteUser);
router.post('/:id/reset-pin', authorize(ROLES.OWNER, ROLES.ADMIN), userController.resetUserPin);

export default router;
