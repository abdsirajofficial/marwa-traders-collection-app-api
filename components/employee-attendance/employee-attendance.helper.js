import { z } from 'zod';
import crypto from 'crypto';

export const signInSchema = z.object({
  location: z.object({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    address: z.string().nullable().optional(),
  }).optional().default({}),
});

export const signOutSchema = z.object({
  workSessionId: z.string().optional(),
  location: z.object({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    address: z.string().nullable().optional(),
  }).optional().default({}),
});

export const generateWorkSessionId = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePrefix = `WS-${year}${month}${day}-`;
  const randomSuffix = crypto.randomInt(100000, 999999);
  return `${datePrefix}${randomSuffix}`;
};

export const getTodayDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
