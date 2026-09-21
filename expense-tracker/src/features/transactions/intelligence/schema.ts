import { z } from 'zod';
import { PAYMENT_METHODS } from '@/lib/intelligence';
import { zEnum } from '@/lib/validation';

/**
 * What the Android companion posts. Either it parsed the message itself and
 * sends structured fields, or it sends the raw message and lets the server
 * parse - both are supported so the phone app can stay dumb if you prefer.
 */
export const syncEventSchema = z
  .object({
    amount: z.coerce.number().positive().optional(),
    type: z.enum(['debit', 'credit']).optional(),
    merchant: z.string().trim().max(120).optional(),
    description: z.string().trim().max(400).optional(),
    source: z.enum(['sms', 'notification']).default('sms'),
    paymentMethod: zEnum(PAYMENT_METHODS).optional(),
    bank: z.string().trim().max(60).optional(),
    accountLast4: z.string().trim().regex(/^\d{3,4}$/).optional(),
    reference: z.string().trim().max(40).optional(),
    transactionAt: z.string().datetime({ offset: true }).optional(),
    /** The raw SMS. Parsed server-side when the structured fields are absent. */
    message: z.string().max(1200).optional(),
    /** SMS sender id, e.g. VM-HDFCBK. Picks the right parser. */
    sender: z.string().max(40).optional(),
  })
  .refine((v) => v.amount !== undefined || Boolean(v.message), {
    message: 'Send either an amount or the raw message',
  });

export const syncPayloadSchema = z.union([
  syncEventSchema,
  z.object({ events: z.array(syncEventSchema).min(1).max(100) }),
]);

export type SyncEvent = z.infer<typeof syncEventSchema>;

export const categorizeSchema = z.object({
  category_id: z.uuid().nullish(),
  bucket: z.enum(['home', 'personal']).optional(),
  need_level: z.enum(['need', 'want', 'waste']).optional(),
  reason: z.string().trim().max(400).nullish(),
  /** Remember this merchant so the same shop is never asked about again. */
  remember: z.coerce.boolean().default(false),
  /** With remember: sort it silently next time rather than just pre-filling. */
  auto_confirm: z.coerce.boolean().default(true),
});

export const reasonSchema = z.object({
  reason: z.string().trim().max(400).nullish(),
});

export const merchantRuleSchema = z.object({
  pattern: z.string().trim().min(2).max(60),
  match_type: z.enum(['contains', 'exact']).default('contains'),
  category_id: z.uuid().nullish(),
  bucket: z.enum(['home', 'personal']).nullish(),
  need_level: z.enum(['need', 'want', 'waste']).nullish(),
  auto_confirm: z.coerce.boolean().default(true),
});
export const merchantRuleUpdateSchema = merchantRuleSchema.partial();
