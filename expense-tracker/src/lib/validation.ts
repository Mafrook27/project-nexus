import { z } from 'zod';
import { parseAmount } from './money';

/** Shared zod building blocks. Forms post strings, so most of these coerce. */

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

/**
 * People type money the way they read it: "1,250", "₹1,20,000", "12k". Accept
 * all of it rather than making the form reject a perfectly clear number.
 */
const toAmount = (v: unknown) => (typeof v === 'string' ? parseAmount(v) : v);

export const zId = z.uuid();
export const zOptionalId = z.preprocess(emptyToNull, z.uuid().nullable()).optional();
export const zMoney = z.preprocess(toAmount, z.number().finite());
export const zPositiveMoney = z.preprocess(
  toAmount,
  z.number().finite().positive('Enter an amount above zero'),
);
export const zRate = z.coerce.number().min(-100).max(100);
export const zText = (max = 200) => z.string().trim().min(1, 'Required').max(max);
export const zOptionalText = (max = 500) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional();
export const zISODate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');
export const zOptionalISODate = z
  .preprocess(emptyToNull, zISODate.nullable())
  .optional();
export const zMonth = z.string().regex(/^(\d{4}-\d{2}|default)$/, 'Use YYYY-MM');
export const zBool = z.coerce.boolean();

export const zEnum = <T extends readonly { value: string }[]>(options: T) =>
  z.enum(options.map((o) => o.value) as [string, ...string[]]);

/** Turns a create-schema into an update-schema (all fields optional). */
export const partial = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) => schema.partial();
