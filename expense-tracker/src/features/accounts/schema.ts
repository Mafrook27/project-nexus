import { z } from 'zod';
import { ACCOUNT_TYPES } from '@/lib/constants';
import { zEnum, zMoney, zOptionalId, zOptionalText, zText } from '@/lib/validation';

export const accountSchema = z.object({
  name: zText(80),
  type: zEnum(ACCOUNT_TYPES).default('bank'),
  person_id: zOptionalId,
  institution: zOptionalText(80),
  opening_balance: zMoney.default(0),
  is_emergency: z.coerce.boolean().default(false),
  archived: z.coerce.boolean().default(false),
});
export const accountUpdateSchema = accountSchema.partial();

export type Account = {
  id: string;
  name: string;
  type: string;
  person_id: string | null;
  person_name?: string | null;
  institution: string | null;
  opening_balance: number;
  is_emergency: boolean;
  archived: boolean;
  /** opening balance +/- every posted transaction (computed by the API) */
  balance: number;
};
