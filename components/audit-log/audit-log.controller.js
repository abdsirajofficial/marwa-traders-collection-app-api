import * as auditService from './audit-log.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const getAuditLogs = catchAsync(async (req, res) => {
  const { action, entity, role, page, limit } = req.query;
  const result = await auditService.getAuditLogs({
    action,
    entity,
    role,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  return sendResponse(res, 'Audit logs retrieved', result);
});
