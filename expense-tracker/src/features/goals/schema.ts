import { z } from 'zod';
import { GOAL_KINDS } from '@/lib/constants';
import { zEnum, zMoney, zOptionalISODate, zPositiveMoney, zText } from '@/lib/validation';

export const goalSchema = z.object({
  name: zText(120),
  kind: zEnum(GOAL_KINDS).default('custom'),
  target_amount: zPositiveMoney,
  saved_amount: zMoney.default(0),
  monthly_contribution: zMoney.default(0),
  target_date: zOptionalISODate,
});
export const goalUpdateSchema = goalSchema.partial();

export type Goal = {
  id: string;
  name: string;
  kind: string;
  target_amount: number;
  saved_amount: number;
  monthly_contribution: number;
  target_date: string | null;
};
