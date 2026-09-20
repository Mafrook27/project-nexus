import { z } from 'zod';
import { BUCKETS, NEED_LEVELS, TXN_TYPES } from '@/lib/constants';
import { TXN_STATUSES } from '@/lib/intelligence';
import {
  zEnum,
  zISODate,
  zOptionalId,
  zOptionalText,
  zPositiveMoney,
} from '@/lib/validation';

export const transactionSchema = z.object({
  type: zEnum(TXN_TYPES).default('expense'),
  bucket: zEnum(BUCKETS).default('personal'),
  need_level: zEnum(NEED_LEVELS).default('need'),
  amount: zPositiveMoney,
  txn_date: zISODate,
  account_id: zOptionalId,
  to_account_id: zOptionalId,
  category_id: zOptionalId,
  person_id: zOptionalId,
  merchant: zOptionalText(120),
  note: zOptionalText(400),
  reason: zOptionalText(400),
  status: zEnum(TXN_STATUSES).default('confirmed'),
});
export const transactionUpdateSchema = transactionSchema.partial();

export const transactionFilterSchema = z.object({
  month: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.string().optional(),
  bucket: z.string().optional(),
  need_level: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  category_id: z.string().optional(),
  account_id: z.string().optional(),
  person_id: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export type Transaction = {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  bucket: 'home' | 'personal';
  need_level: 'need' | 'want' | 'waste';
  amount: number;
  txn_date: string;
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  person_id: string | null;
  merchant: string | null;
  note: string | null;
  reason: string | null;
  status: 'detected' | 'confirmed' | 'categorized' | 'ignored';
  source: 'manual' | 'sms' | 'notification' | 'import';
  payment_method: string;
  bank: string | null;
  account_last4: string | null;
  transaction_at: string | null;
  category_name?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
  account_name?: string | null;
  person_name?: string | null;
};
