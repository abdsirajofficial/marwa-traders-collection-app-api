import { z } from 'zod';
import crypto from 'crypto';
import { Payment } from './payment.model.js';

export const paymentCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMode: z.enum(['CASH', 'GPAY']).default('CASH'),
  location: z.object({
    locationName: z.string().nullable().optional(),
    latitude: z.number().nullable().optional().default(null),
    longitude: z.number().nullable().optional().default(null),
    address: z.string().nullable().optional(),
  }).optional().default({}),
  idempotencyKey: z.string().optional(),
  workSessionId: z.string().optional(),
});

export const correctionRequestSchema = z.object({
  requestedAmount: z.number().min(0, 'Requested amount cannot be negative'),
  reason: z.string().min(3, 'Reason for correction must be provided').trim(),
});

export const generateReceiptNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `MRT-${year}${month}${day}-`;

  const startOfDay = new Date(year, now.getMonth(), now.getDate());
  const countToday = await Payment.countDocuments({
    createdAt: { $gte: startOfDay },
  });

  const nextSeq = String(countToday + 1).padStart(6, '0');
  let candidate = `${datePrefix}${nextSeq}`;

  const exists = await Payment.findOne({ receiptNumber: candidate });
  if (exists) {
    const randomSuffix = crypto.randomInt(100000, 999999);
    candidate = `${datePrefix}${randomSuffix}`;
  }

  return candidate;
};
