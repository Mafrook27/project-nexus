import { z } from 'zod';
import { zOptionalId } from '@/lib/validation';

/** One parsed CSV line, already mapped to columns by the importer UI. */
export const importRowSchema = z.object({
  txn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().finite(),
  type: z.enum(['expense', 'income', 'transfer']).default('expense'),
  bucket: z.enum(['home', 'personal']).default('personal'),
  category: z.string().trim().max(60).optional(),
  merchant: z.string().trim().max(120).optional(),
  note: z.string().trim().max(400).optional(),
});

export const importPayloadSchema = z.object({
  account_id: zOptionalId,
  person_id: zOptionalId,
  /** Create any category name that does not exist yet. */
  create_missing_categories: z.coerce.boolean().default(true),
  rows: z.array(importRowSchema).min(1, 'Nothing to import').max(2000),
});

export type ImportRow = z.infer<typeof importRowSchema>;
