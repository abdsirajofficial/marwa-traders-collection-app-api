import { User } from './user.model.js';
import { ApiError } from '../../common/utils/api-error.util.js';
import { logAuditEvent } from '../audit-log/audit-log.service.js';
import { ROLES, AUDIT_ACTIONS } from '../../common/utils/constants.js';

export const getUsers = async (role = null) => {
  const filter = { isRemoved: { $ne: true } };
  if (role) filter.role = role;
  return User.find(filter).select('-pinHash').sort({ code: 1 });
};

export const getCollectors = async () => {
  return User.find({ role: ROLES.CASH_COLLECTOR, isActive: true, isRemoved: { $ne: true } })
    .select('name code phone role')
    .sort({ code: 1 });
};

export const createUser = async (data, creatorUser) => {
  // Role-based permission enforcement:
  // OWNER can create all roles (OWNER, ADMIN, STAFF, CASH_COLLECTOR)
  // ADMIN can create ADMIN and CASH_COLLECTOR
  if (creatorUser?.role === ROLES.ADMIN) {
    const allowedRoles = [ROLES.ADMIN, ROLES.CASH_COLLECTOR];
    if (!allowedRoles.includes(data.role)) {
      throw new ApiError(403, 'Admins can only create ADMIN or CASH_COLLECTOR accounts');
    }
  } else if (creatorUser?.role !== ROLES.OWNER) {
    throw new ApiError(403, 'You do not have permission to create users');
  }

  if (!data.code || !data.name || !data.role) {
    throw new ApiError(400, 'Code, name, and role are required fields');
  }

  const existing = await User.findOne({ code: data.code.trim() });
  if (existing) {
    throw new ApiError(400, `User with code "${data.code}" already exists`);
  }

  const user = await User.create({
    code: data.code.trim(),
    name: data.name.trim(),
    role: data.role,
    phone: data.phone?.trim() || '',
    permissions: data.permissions || [],
    isActive: true,
    isRemoved: false,
  });

  await logAuditEvent({
    userId: creatorUser?._id,
    userCode: creatorUser?.code,
    role: creatorUser?.role,
    action: AUDIT_ACTIONS.CREATE_USER || 'CREATE_USER',
    entity: 'USER',
    entityId: user._id.toString(),
    description: `Created user ${user.name} (${user.role}) with code ${user.code}`,
  });

  return user;
};

export const updateUser = async (id, data, updaterUser) => {
  const user = await User.findById(id);
  if (!user || user.isRemoved) throw new ApiError(404, 'User not found');

  if (updaterUser?.role === ROLES.ADMIN) {
    if (user.role === ROLES.OWNER) {
      throw new ApiError(403, 'Admins cannot modify Owner accounts');
    }
    if (data.role && ![ROLES.ADMIN, ROLES.CASH_COLLECTOR].includes(data.role)) {
      throw new ApiError(403, 'Admins can only assign Admin or Cash Collector roles');
    }
  } else if (updaterUser?.role !== ROLES.OWNER) {
    throw new ApiError(403, 'Unauthorized to modify user');
  }

  // Check code uniqueness if code changed
  if (data.code && data.code.trim() !== user.code) {
    const codeConflict = await User.findOne({
      code: data.code.trim(),
      _id: { $ne: user._id },
      isRemoved: { $ne: true },
    });
    if (codeConflict) {
      throw new ApiError(400, `User with code "${data.code.trim()}" already exists`);
    }
    user.code = data.code.trim();
  }

  if (data.name) user.name = data.name.trim();
  if (data.phone !== undefined) user.phone = data.phone.trim();

  if (data.role && data.role !== user.role) {
    if (user._id.toString() === updaterUser?._id?.toString()) {
      throw new ApiError(400, 'Cannot change your own role');
    }
    user.role = data.role;
  }

  await user.save();

  await logAuditEvent({
    userId: updaterUser?._id,
    userCode: updaterUser?.code,
    role: updaterUser?.role,
    action: 'UPDATE_USER',
    entity: 'USER',
    entityId: user._id.toString(),
    description: `Updated user details for ${user.name} (${user.code})`,
  });

  return user;
};

export const deleteUser = async (id, updaterUser) => {
  const user = await User.findById(id);
  if (!user || user.isRemoved) throw new ApiError(404, 'User not found');

  if (user._id.toString() === updaterUser?._id?.toString() || user.code === updaterUser?.code) {
    throw new ApiError(400, 'You cannot delete your own active account');
  }

  if (updaterUser?.role === ROLES.ADMIN) {
    if (user.role === ROLES.OWNER) {
      throw new ApiError(403, 'Admins cannot delete Owner accounts');
    }
    if (![ROLES.ADMIN, ROLES.CASH_COLLECTOR].includes(user.role)) {
      throw new ApiError(403, 'Admins can only delete Admin or Cash Collector accounts');
    }
  } else if (updaterUser?.role !== ROLES.OWNER) {
    throw new ApiError(403, 'Unauthorized to delete user');
  }

  // Soft delete: set isRemoved to true and isActive to false
  user.isRemoved = true;
  user.isActive = false;
  await user.save();

  await logAuditEvent({
    userId: updaterUser?._id,
    userCode: updaterUser?.code,
    role: updaterUser?.role,
    action: 'DELETE_USER',
    entity: 'USER',
    entityId: user._id.toString(),
    description: `Soft deleted user ${user.name} (${user.role}, code: ${user.code})`,
  });

  return user;
};

export const updateUserStatus = async (id, isActive, updaterUser) => {
  const user = await User.findById(id);
  if (!user || user.isRemoved) throw new ApiError(404, 'User not found');

  if (updaterUser?.role === ROLES.ADMIN) {
    if (user.role === ROLES.OWNER) {
      throw new ApiError(403, 'Admins cannot modify Owner accounts');
    }
    const allowedRoles = [ROLES.ADMIN, ROLES.CASH_COLLECTOR];
    if (!allowedRoles.includes(user.role)) {
      throw new ApiError(403, 'Admins can only modify Admin or Cash Collector accounts');
    }
  } else if (updaterUser?.role !== ROLES.OWNER) {
    throw new ApiError(403, 'Unauthorized to modify user status');
  }

  user.isActive = isActive;
  await user.save();
  return user;
};

export const resetUserPin = async (id, updaterUser) => {
  const user = await User.findById(id);
  if (!user || user.isRemoved) throw new ApiError(404, 'User not found');
  return user;
};

