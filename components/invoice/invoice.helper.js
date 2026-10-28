import { z } from 'zod';

export const applyInvoiceStatus = (invoice) => {
  const net = Math.max(0, Number(invoice.invoiceAmount || 0) - Number(invoice.initialPayment || 0));
  let outstanding = Number(invoice.outstandingAmount || 0);
  if (outstanding > net) outstanding = net;
  if (outstanding < 0) outstanding = 0;
  invoice.outstandingAmount = outstanding;

  if (outstanding === 0) {
    invoice.status = 'PAID';
  } else if (Number(invoice.initialPayment || 0) > 0 || outstanding < net) {
    invoice.status = 'PARTIALLY_PAID';
  } else {
    invoice.status = 'UNPAID';
  }

  return invoice;
};

export const invoiceCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required').trim(),
  invoiceDate: z.string().datetime().optional().or(z.date().optional()).or(z.string().optional()),
  invoiceAmount: z.number().positive('Invoice amount must be greater than zero'),
  initialPayment: z.number().min(0, 'Initial payment cannot be negative').default(0),
});
