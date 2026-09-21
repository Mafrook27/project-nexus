import { z } from 'zod';
import { BUCKETS, FREQUENCIES } from '@/lib/constants';
import { zEnum, zISODate, zOptionalId, zPositiveMoney, zText } from '@/lib/validation';

export const recurringSchema = z.object({
  name: zText(120),
  amount: zPositiveMoney,
  type: z.enum(['expense', 'income']).default('expense'),
  bucket: zEnum(BUCKETS).default('home'),
  frequency: zEnum(FREQUENCIES).default('monthly'),
  next_due: zISODate,
  account_id: zOptionalId,
  category_id: zOptionalId,
  active: z.coerce.boolean().default(true),
});
export const recurringUpdateSchema = recurringSchema.partial();

export type Recurring = {
  id: string;
  name: string;
  amount: number;
  type: 'expense' | 'income';
  bucket: 'home' | 'personal';
  frequency: string;
  next_due: string;
  account_id: string | null;
  category_id: string | null;
  category_name?: string | null;
  account_name?: string | null;
  active: boolean;
};
