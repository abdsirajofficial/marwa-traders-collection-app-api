import { AuditLog } from './audit-log.model.js';

export const logAuditEvent = async ({
  userId = null,
  userCode = '',
  role = 'SYSTEM',
  action,
  entity,
  entityId = '',
  description,
  ipAddress = null,
  metadata = {},
}) => {
  try {
    return await AuditLog.create({
      userId,
      userCode,
      role,
      action,
      entity,
      entityId: String(entityId),
      description,
      ipAddress,
      metadata,
    });
  } catch (error) {
    console.error('[AuditService] Failed to record audit log:', error.message);
  }
};

export const getAuditLogs = async ({ action, entity, role, page = 1, limit = 50 }) => {
  const filter = {};
  if (action) filter.action = action;
  if (entity) filter.entity = entity;
  if (role) filter.role = role;

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('userId', 'name code role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, total, page, totalPages: Math.ceil(total / limit) };
};
