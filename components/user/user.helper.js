import { z } from 'zod';
import { ROLES } from '../../common/utils/constants.js';

export const userCreateSchema = z.object({
  code: z.string().min(1, 'User code is required').trim(),
  name: z.string().min(2, 'Name is required').trim(),
  role: z.enum(Object.values(ROLES)),
  phone: z.string().optional(),
  permissions: z.array(z.string()).optional().default([]),
});
