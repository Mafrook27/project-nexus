import { z } from 'zod';
import { zId, zMonth, zPositiveMoney } from '@/lib/validation';

export const budgetSchema = z.object({
  category_id: zId,
  month: zMonth.default('default'),
  amount: zPositiveMoney,
});
export const budgetUpdateSchema = budgetSchema.partial();

export type Budget = {
  id: string;
  category_id: string;
  month: string;
  amount: number;
  category_name?: string;
  category_color?: string;
  bucket?: 'home' | 'personal';
  spent?: number;
};
