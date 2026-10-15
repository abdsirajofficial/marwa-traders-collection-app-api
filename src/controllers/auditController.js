import { AuditLog } from '../models/AuditLog.js';
import { successResponse } from '../utils/response.js';

export async function getAuditLogs(req, res, next) {
  try {
    const { action, entity, role, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (role) filter.role = role;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'name code role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      AuditLog.countDocuments(filter),
    ]);

    return successResponse(res, {
      logs,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    next(error);
  }
}
