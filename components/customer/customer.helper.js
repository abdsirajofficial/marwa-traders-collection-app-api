import { z } from 'zod';
import crypto from 'crypto';
import { Customer } from './customer.model.js';

export const customerCreateSchema = z.object({
  shopName: z.string().min(2, 'Shop name must be at least 2 characters').trim(),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters').trim(),
  mobile: z.string().min(10, 'Mobile number must be at least 10 digits').regex(/^[0-9+ ]+$/, 'Invalid phone number format').trim(),
  address: z.string().min(2, 'Address is required').trim(),
  openingBalance: z.number().min(0, 'Opening balance cannot be negative').default(0),
});

export const customerUpdateSchema = z.object({
  shopName: z.string().min(2).trim().optional(),
  ownerName: z.string().min(2).trim().optional(),
  mobile: z.string().min(10).trim().optional(),
  address: z.string().min(2).trim().optional(),
  openingBalance: z.number().min(0).optional(),
});

export const generateCustomerCode = async () => {
  const total = await Customer.countDocuments();
  const nextSeq = String(total + 1).padStart(6, '0');
  let candidate = `CUS-${nextSeq}`;

  const exists = await Customer.findOne({ customerCode: candidate });
  if (exists) {
    const randomSuffix = crypto.randomInt(100000, 999999);
    candidate = `CUS-${randomSuffix}`;
  }

  return candidate;
};
