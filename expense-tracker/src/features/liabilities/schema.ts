import { z } from 'zod';
import { LIABILITY_TYPES } from '@/lib/constants';
import { zEnum, zMoney, zOptionalId, zOptionalISODate, zRate, zText } from '@/lib/validation';

export const liabilitySchema = z.object({
  name: zText(120),
  type: zEnum(LIABILITY_TYPES).default('loan'),
  person_id: zOptionalId,
  principal: zMoney.default(0),
  outstanding: zMoney.default(0),
  interest_rate: zRate.default(0),
  emi: zMoney.default(0),
  end_date: zOptionalISODate,
});
export const liabilityUpdateSchema = liabilitySchema.partial();

export type Liability = {
  id: string;
  name: string;
  type: string;
  person_id: string | null;
  person_name?: string | null;
  principal: number;
  outstanding: number;
  interest_rate: number;
  emi: number;
  end_date: string | null;
};
