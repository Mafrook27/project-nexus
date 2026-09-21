import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1, 'Tell us your name').max(80),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
