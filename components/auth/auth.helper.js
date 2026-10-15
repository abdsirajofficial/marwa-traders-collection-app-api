import { z } from 'zod';

export const loginSchema = z.object({
  code: z.string().min(1, 'Login code/PIN is required').trim(),
});
