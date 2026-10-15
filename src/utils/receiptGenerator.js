import crypto from 'crypto';
import { Payment } from '../models/Payment.js';
import { Customer } from '../models/Customer.js';
import { Settlement } from '../models/Settlement.js';

/**
 * Generates receipt number in format: MRT-YYYYMMDD-XXXXXX
 * Example: MRT-20261014-000125
 */
export async function generateReceiptNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `MRT-${year}${month}${day}-`;

  // Count payments created today to increment sequence
  const startOfDay = new Date(year, now.getMonth(), now.getDate());
  const countToday = await Payment.countDocuments({
    createdAt: { $gte: startOfDay },
  });

  const nextSeq = String(countToday + 1).padStart(6, '0');
  let candidate = `${datePrefix}${nextSeq}`;

  // Ensure collision avoidance
  const exists = await Payment.findOne({ receiptNumber: candidate });
  if (exists) {
    const randomSuffix = crypto.randomInt(100000, 999999);
    candidate = `${datePrefix}${randomSuffix}`;
  }

  return candidate;
}

/**
 * Generates customer code in format: CUS-000001
 */
export async function generateCustomerCode() {
  const total = await Customer.countDocuments();
  const nextSeq = String(total + 1).padStart(6, '0');
  let candidate = `CUS-${nextSeq}`;

  const exists = await Customer.findOne({ customerCode: candidate });
  if (exists) {
    const randomSuffix = crypto.randomInt(100000, 999999);
    candidate = `CUS-${randomSuffix}`;
  }

  return candidate;
}

/**
 * Generates settlement number in format: STL-YYYYMMDD-XXXXXX
 */
export async function generateSettlementNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `STL-${year}${month}${day}-`;

  const startOfDay = new Date(year, now.getMonth(), now.getDate());
  const countToday = await Settlement.countDocuments({
    createdAt: { $gte: startOfDay },
  });

  const nextSeq = String(countToday + 1).padStart(6, '0');
  return `${datePrefix}${nextSeq}`;
}
