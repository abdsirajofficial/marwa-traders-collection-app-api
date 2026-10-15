import { AuditLog } from '../models/AuditLog.js';

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
    await AuditLog.create({
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
    // Non-blocking for primary transaction, but logged
    console.error('[AuditService] Failed to record audit log:', error.message);
  }
};
