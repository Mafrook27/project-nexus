import { one, transaction } from '@/server/db/client';
import { requireUser } from '@/features/auth/session';
import { categorizeSchema } from '@/features/transactions/intelligence/schema';
import { notFound, ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';

/**
 * Answers "what was this?" for one detected transaction, and optionally
 * teaches the app so it never asks about that merchant again.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = categorizeSchema.parse(await readJson(req));

  const existing = await one<{ merchant: string | null }>(
    `SELECT merchant FROM transactions WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!existing) throw notFound('Transaction not found');

  return transaction(async (q) => {
    const [row] = await q(
      `UPDATE transactions SET
         category_id = COALESCE($3, category_id),
         bucket      = COALESCE($4, bucket),
         need_level  = COALESCE($5, need_level),
         reason      = COALESCE($6, reason),
         status      = 'categorized',
         updated_at  = now()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id,
        user.id,
        input.category_id ?? null,
        input.bucket ?? null,
        input.need_level ?? null,
        input.reason ?? null,
      ],
    );

    let rule = null;
    if (input.remember && existing.merchant && input.category_id) {
      [rule] = await q(
        `INSERT INTO merchant_rules
           (user_id, pattern, match_type, category_id, bucket, need_level, auto_confirm)
         VALUES ($1, $2, 'contains', $3, $4, $5, $6)
         ON CONFLICT (user_id, pattern, match_type) DO UPDATE
           SET category_id  = EXCLUDED.category_id,
               bucket       = EXCLUDED.bucket,
               need_level   = EXCLUDED.need_level,
               auto_confirm = EXCLUDED.auto_confirm
         RETURNING *`,
        [
          user.id,
          existing.merchant,
          input.category_id,
          input.bucket ?? null,
          input.need_level ?? null,
          input.auto_confirm,
        ],
      );
    }

    return ok({ transaction: row, rule });
  });
});
