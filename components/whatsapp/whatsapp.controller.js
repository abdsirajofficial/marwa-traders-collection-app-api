import * as whatsappService from './whatsapp.service.js';
import { catchAsync } from '../../common/utils/catch-async.util.js';
import { sendResponse } from '../../common/utils/endpoint.util.js';

export const getNotificationLogs = catchAsync(async (req, res) => {
  const result = await whatsappService.getNotificationLogs(
    req.query,
    req.query.page ? parseInt(req.query.page, 10) : 1,
    req.query.limit ? parseInt(req.query.limit, 10) : 50
  );
  return sendResponse(res, 'Notification logs retrieved', result);
});

export const retryNotification = catchAsync(async (req, res) => {
  const updated = await whatsappService.retryNotification(req.params.id);
  return sendResponse(res, 'Notification retry triggered', { notification: updated });
});
