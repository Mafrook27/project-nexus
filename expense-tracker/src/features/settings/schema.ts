import { z } from 'zod';

/** Stored on users.settings (jsonb) - the FIRE/retirement assumptions. */
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']).optional(),
  settings: z
    .object({
      current_age: z.coerce.number().min(15).max(90).optional(),
      retire_age: z.coerce.number().min(20).max(95).optional(),
      life_expectancy: z.coerce.number().min(50).max(110).optional(),
      monthly_expenses: z.coerce.number().nonnegative().optional(),
      /** % of expenses you expect to still have after retiring */
      expense_ratio_in_retirement: z.coerce.number().min(10).max(150).optional(),
      inflation: z.coerce.number().min(0).max(20).optional(),
      pre_retirement_return: z.coerce.number().min(0).max(30).optional(),
      post_retirement_return: z.coerce.number().min(0).max(30).optional(),
      withdrawal_rate: z.coerce.number().min(1).max(10).optional(),
      emergency_months: z.coerce.number().min(1).max(36).optional(),
      monthly_investment: z.coerce.number().nonnegative().optional(),
    })
    .partial()
    .optional(),
});

export type FireSettings = NonNullable<z.infer<typeof profileSchema>['settings']>;

export const DEFAULT_FIRE_SETTINGS: Required<FireSettings> = {
  current_age: 28,
  retire_age: 50,
  life_expectancy: 85,
  monthly_expenses: 40000,
  expense_ratio_in_retirement: 90,
  inflation: 6,
  pre_retirement_return: 12,
  post_retirement_return: 8,
  withdrawal_rate: 4,
  emergency_months: 6,
  monthly_investment: 30000,
};
