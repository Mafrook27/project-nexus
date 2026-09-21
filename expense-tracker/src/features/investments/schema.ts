import { z } from 'zod';
import { INVESTMENT_TYPES } from '@/lib/constants';
import {
  zEnum,
  zMoney,
  zOptionalId,
  zOptionalISODate,
  zOptionalText,
  zText,
} from '@/lib/validation';

export const investmentSchema = z.object({
  name: zText(120),
  type: zEnum(INVESTMENT_TYPES).default('mutual_fund'),
  person_id: zOptionalId,
  symbol: zOptionalText(30),
  units: z.coerce.number().nonnegative().nullish(),
  avg_price: z.coerce.number().nonnegative().nullish(),
  last_price: z.coerce.number().nonnegative().nullish(),
  invested: zMoney.default(0),
  current_value: zMoney.default(0),
  start_date: zOptionalISODate,
  maturity_date: zOptionalISODate,
  liquid: z.coerce.boolean().default(true),
  notes: zOptionalText(400),
});
export const investmentUpdateSchema = investmentSchema.partial();

/** Payload from the CSV importer on the Stocks page. */
export const holdingImportSchema = z.object({
  person_id: zOptionalId,
  replace: z.coerce.boolean().default(false),
  rows: z
    .array(
      z.object({
        symbol: z.string().trim().min(1).max(30),
        name: z.string().trim().max(120).optional(),
        units: z.coerce.number().positive(),
        avg_price: z.coerce.number().nonnegative(),
        last_price: z.coerce.number().nonnegative().optional(),
        type: z.string().optional(),
      }),
    )
    .min(1, 'No usable rows found in that file'),
});

export type Investment = {
  id: string;
  name: string;
  type: string;
  person_id: string | null;
  person_name?: string | null;
  symbol: string | null;
  units: number | null;
  avg_price: number | null;
  last_price: number | null;
  invested: number;
  current_value: number;
  start_date: string | null;
  maturity_date: string | null;
  liquid: boolean;
  notes: string | null;
  updated_at: string;
};
