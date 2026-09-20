import { z } from 'zod';
import { BUCKETS } from '@/lib/constants';
import { zEnum, zText } from '@/lib/validation';

export const categorySchema = z.object({
  name: zText(60),
  kind: z.enum(['expense', 'income']).default('expense'),
  bucket: zEnum(BUCKETS).default('personal'),
  icon: z.string().max(40).default('Circle'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#64748B'),
});
export const categoryUpdateSchema = categorySchema.partial();

export type Category = {
  id: string;
  name: string;
  kind: 'expense' | 'income';
  bucket: 'home' | 'personal';
  icon: string;
  color: string;
};
