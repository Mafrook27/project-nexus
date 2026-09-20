import { z } from 'zod';
import { zISODate, zOptionalId, zPositiveMoney, zRate, zText } from '@/lib/validation';

export const sipSchema = z.object({
  name: zText(120),
  amount: zPositiveMoney,
  person_id: zOptionalId,
  investment_id: zOptionalId,
  day_of_month: z.coerce.number().int().min(1).max(28).default(1),
  expected_return: zRate.default(12),
  step_up_pct: zRate.default(0),
  start_date: zISODate,
  active: z.coerce.boolean().default(true),
});
export const sipUpdateSchema = sipSchema.partial();

export type Sip = {
  id: string;
  name: string;
  amount: number;
  person_id: string | null;
  person_name?: string | null;
  investment_id: string | null;
  day_of_month: number;
  expected_return: number;
  step_up_pct: number;
  start_date: string;
  active: boolean;
};
