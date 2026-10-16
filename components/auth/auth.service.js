import { User } from '../user/user.model.js';
import { generateAuthToken } from '../../common/service/token.service.js';
import { ApiError } from '../../common/utils/api-error.util.js';
import { logAuditEvent } from '../audit-log/audit-log.service.js';
import { ROLES, AUDIT_ACTIONS } from '../../common/utils/constants.js';

export const loginWithCode = async (code, ipAddress = null, client = null) => {
  const trimmedCode = code.trim();
  const user = await User.findOne({ code: trimmedCode });

  if (!user || user.isRemoved) {
    throw new ApiError(401, 'Invalid code. Access denied.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'User account is inactive. Please contact administrator.');
  }

  // Mobile App restriction: Only OWNER and CASH_COLLECTOR are authorized
  if (client === 'mobile' && user.role !== ROLES.OWNER && user.role !== ROLES.CASH_COLLECTOR) {
    throw new ApiError(
      403,
      'Access denied: Only Owner and Cash Collectors are authorized to login to the mobile collection app.'
    );
  }

  const token = generateAuthToken(user);

  await logAuditEvent({
    userId: user._id,
    userCode: user.code,
    role: user.role,
    action: AUDIT_ACTIONS.EMPLOYEE_LOGIN,
    entity: 'USER',
    entityId: user._id.toString(),
    description: `User ${user.name} (${user.role}) authenticated into application with code ${user.code}`,
    ipAddress,
  });

  return {
    token,
    user: {
      id: user._id,
      code: user.code,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    },
  };
};

export const logoutUser = async (user, ipAddress = null) => {
  if (user) {
    await logAuditEvent({
      userId: user._id,
      userCode: user.code,
      role: user.role,
      action: AUDIT_ACTIONS.LOGOUT,
      entity: 'USER',
      entityId: user._id.toString(),
      description: `User ${user.name} logged out from application`,
      ipAddress,
    });
  }
};
