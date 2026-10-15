import { z } from 'zod';
import { Settlement } from './settlement.model.js';

export const settlementCreateSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  receivedAmount: z.number().min(0, 'Received amount cannot be negative'),
  notes: z.string().optional(),
});

export const correctionReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().optional(),
});

export const generateSettlementNumber = async () => {
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
};
