import { AUDIT_ACTIONS } from '../../common/utils/constants.js';

export const isFinancialAction = (action) => {
  return [
    AUDIT_ACTIONS.CREATE_PAYMENT,
    AUDIT_ACTIONS.PAYMENT_REVERSED,
    AUDIT_ACTIONS.CREATE_SETTLEMENT,
    AUDIT_ACTIONS.CREATE_INVOICE,
    AUDIT_ACTIONS.EMPLOYEE_COLLECTION_CREATED,
  ].includes(action);
};
