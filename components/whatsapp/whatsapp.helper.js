export const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString('en-IN');
};

export const formatDateTime = (date = new Date()) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateStr = `${day}-${month}-${year}`;

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

  return { dateStr, timeStr };
};

/**
 * Section 20: Template marwa_payment_receipt
 */
export const buildCustomerPaymentReceiptMessage = ({
  customerName,
  receiptNumber,
  previousOutstanding,
  amountReceived,
  currentOutstanding,
  collectedByName,
  createdAt,
}) => {
  const { dateStr, timeStr } = formatDateTime(createdAt);

  return (
    `MARWA TRADERS\n\n` +
    `Payment received successfully.\n\n` +
    `Customer: ${customerName}\n` +
    `Receipt No: ${receiptNumber}\n\n` +
    `Previous Outstanding: ₹${formatCurrency(previousOutstanding)}\n` +
    `Amount Received: ₹${formatCurrency(amountReceived)}\n` +
    `Current Outstanding: ₹${formatCurrency(currentOutstanding)}\n\n` +
    `Collected By: ${collectedByName}\n` +
    `Date: ${dateStr}\n` +
    `Time: ${timeStr}\n\n` +
    `Thank you for your payment.`
  );
};

/**
 * Section 21: Template marwa_employee_daily_report
 */
export const buildOwnerDailyReportMessage = ({
  employeeName,
  dateStr,
  signInTime,
  signInLocation,
  signOutTime,
  signOutLocation,
  totalTransactions,
  totalCashCollected,
  collections = [],
  expectedCash,
}) => {
  const signInTimeStr = formatDateTime(signInTime).timeStr;
  const signOutTimeStr = formatDateTime(signOutTime).timeStr;
  const signInLocStr = signInLocation?.address || (signInLocation?.latitude ? `${signInLocation.latitude}, ${signInLocation.longitude}` : 'Salem');
  const signOutLocStr = signOutLocation?.address || (signOutLocation?.latitude ? `${signOutLocation.latitude}, ${signOutLocation.longitude}` : 'Salem');

  // Build itemized dynamic collection details
  let collectionDetailsText = 'No collections recorded for this session.';
  if (collections.length > 0) {
    collectionDetailsText = collections
      .map((col, idx) => {
        const timeStr = formatDateTime(col.createdAt).timeStr;
        const shop = col.customerId?.shopName || 'Customer';
        const loc = col.location?.locationName || col.location?.address || 'Counter';
        return (
          `${idx + 1}. ${shop}\n` +
          `   Amount: ₹${formatCurrency(col.amount)}\n` +
          `   Receipt: ${col.receiptNumber}\n` +
          `   Time: ${timeStr}\n` +
          `   Location: ${loc}`
        );
      })
      .join('\n\n');
  }

  return (
    `MARWA TRADERS — DAILY COLLECTION REPORT\n\n` +
    `Employee: ${employeeName}\n` +
    `Date: ${dateStr}\n\n` +
    `Sign In: ${signInTimeStr}\n` +
    `Sign In Location: ${signInLocStr}\n\n` +
    `Sign Out: ${signOutTimeStr}\n` +
    `Sign Out Location: ${signOutLocStr}\n\n` +
    `Total Transactions: ${totalTransactions}\n` +
    `Total Cash Collected: ₹${formatCurrency(totalCashCollected)}\n\n` +
    `Collection Details:\n\n` +
    `${collectionDetailsText}\n\n` +
    `Expected Cash: ₹${formatCurrency(expectedCash)}\n\n` +
    `Employee signed out successfully.`
  );
};
