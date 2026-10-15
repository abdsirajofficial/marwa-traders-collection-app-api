import { sendCustomerPaymentReceipt, sendEmployeeDailyReport } from '../../components/whatsapp/whatsapp.service.js';

/**
 * Clean notification provider abstraction (Section 24)
 */
export const NotificationService = {
  /**
   * Dispatches customer payment receipt
   */
  async notifyCustomerPayment(paymentData) {
    try {
      return await sendCustomerPaymentReceipt(paymentData);
    } catch (err) {
      console.error('[NotificationService] Customer notification non-blocking error:', err.message);
    }
  },

  /**
   * Dispatches end-of-day summary report to owner when employee signs out
   */
  async notifyOwnerDailyReport(reportData) {
    try {
      return await sendEmployeeDailyReport(reportData);
    } catch (err) {
      console.error('[NotificationService] Owner daily report non-blocking error:', err.message);
    }
  },
};
