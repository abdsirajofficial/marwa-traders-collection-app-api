import { User } from '../models/User.js';
import { successResponse } from '../utils/response.js';
import { logAuditEvent } from '../services/auditService.js';

export async function getUsers(req, res, next) {
  try {
    const { role } = req.query;
    const filter = { isRemoved: { $ne: true } };
    if (role) filter.role = role;

    const users = await User.find(filter).select('-pinHash').sort({ code: 1 });
    return successResponse(res, { users });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const { code, name, role, phone, permissions } = req.body;

    if (req.user?.role === 'ADMIN') {
      const allowedRoles = ['ADMIN', 'CASH_COLLECTOR'];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Admins can only create ADMIN or CASH_COLLECTOR users',
        });
      }
    } else if (req.user?.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create users',
      });
    }

    const existing = await User.findOne({ code });
    if (existing) {
      return res.status(400).json({ success: false, message: `User with code ${code} already exists` });
    }

    const user = await User.create({
      code,
      name,
      role,
      phone,
      permissions: permissions || [],
      isActive: true,
      isRemoved: false,
    });

    await logAuditEvent({
      userId: req.user._id,
      userCode: req.user.code,
      role: req.user.role,
      action: 'CREATE_USER',
      entity: 'USER',
      entityId: user._id.toString(),
      description: `Created user ${user.name} (${user.role}) with code ${user.code}`,
    });

    return successResponse(res, { user }, 201, 'User created successfully');
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isRemoved) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user?.role === 'ADMIN') {
      if (user.role === 'OWNER') {
        return res.status(403).json({ success: false, message: 'Admins cannot modify Owner accounts' });
      }
      if (req.body.role && !['ADMIN', 'CASH_COLLECTOR'].includes(req.body.role)) {
        return res.status(403).json({ success: false, message: 'Admins can only assign Admin or Cash Collector roles' });
      }
    } else if (req.user?.role !== 'OWNER') {
      return res.status(403).json({ success: false, message: 'Unauthorized to modify user' });
    }

    if (req.body.code && req.body.code.trim() !== user.code) {
      const exists = await User.findOne({ code: req.body.code.trim(), _id: { $ne: user._id }, isRemoved: { $ne: true } });
      if (exists) {
        return res.status(400).json({ success: false, message: `User with code ${req.body.code.trim()} already exists` });
      }
      user.code = req.body.code.trim();
    }

    if (req.body.name) user.name = req.body.name.trim();
    if (req.body.phone !== undefined) user.phone = req.body.phone.trim();
    if (req.body.role && req.body.role !== user.role) {
      if (user._id.toString() === req.user?._id?.toString()) {
        return res.status(400).json({ success: false, message: 'Cannot change your own role' });
      }
      user.role = req.body.role;
    }

    await user.save();
    return successResponse(res, { user }, 200, 'User updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isRemoved) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user._id.toString() === req.user?._id?.toString() || user.code === req.user?.code) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own active account' });
    }

    if (req.user?.role === 'ADMIN') {
      if (user.role === 'OWNER') {
        return res.status(403).json({ success: false, message: 'Admins cannot delete Owner accounts' });
      }
      if (!['ADMIN', 'CASH_COLLECTOR'].includes(user.role)) {
        return res.status(403).json({ success: false, message: 'Admins can only delete Admin or Cash Collector accounts' });
      }
    } else if (req.user?.role !== 'OWNER') {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete user' });
    }

    user.isRemoved = true;
    user.isActive = false;
    await user.save();

    return successResponse(res, { user }, 200, 'User soft deleted successfully');
  } catch (error) {
    next(error);
  }
}

export async function getCollectors(req, res, next) {
  try {
    const collectors = await User.find({ role: 'CASH_COLLECTOR', isActive: true, isRemoved: { $ne: true } })
      .select('name code phone role')
      .sort({ code: 1 });
    return successResponse(res, { collectors });
  } catch (error) {
    next(error);
  }
}
