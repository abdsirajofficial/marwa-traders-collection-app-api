import { z } from 'zod';

export const invoiceCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required').trim(),
  invoiceDate: z.string().datetime().optional().or(z.date().optional()).or(z.string().optional()),
  invoiceAmount: z.number().positive('Invoice amount must be greater than zero'),
  initialPayment: z.number().min(0, 'Initial payment cannot be negative').default(0),
});
