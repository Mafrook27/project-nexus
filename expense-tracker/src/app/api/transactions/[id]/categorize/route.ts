import { merchantRules, newId, transactions } from '@/server/db/mongo';
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

  const existing = await transactions().findOne({ _id: id, user_id: user.id });
  if (!existing) throw notFound('Transaction not found');

  const set: Record<string, unknown> = { status: 'categorized', updated_at: new Date() };
  if (input.category_id) set.category_id = input.category_id;
  if (input.bucket) set.bucket = input.bucket;
  if (input.need_level) set.need_level = input.need_level;
  if (input.reason !== undefined && input.reason !== null) set.reason = input.reason;

  const updated = await transactions().findOneAndUpdate(
    { _id: id, user_id: user.id },
    { $set: set },
    { returnDocument: 'after' },
  );

  let rule = null;
  if (input.remember && existing.merchant && input.category_id) {
    rule = await merchantRules().findOneAndUpdate(
      { user_id: user.id, pattern: existing.merchant, match_type: 'contains' },
      {
        $set: {
          category_id: input.category_id,
          bucket: input.bucket ?? null,
          need_level: input.need_level ?? null,
          auto_confirm: input.auto_confirm,
        },
        $setOnInsert: {
          _id: newId(),
          user_id: user.id,
          pattern: existing.merchant,
          match_type: 'contains',
          hits: 0,
          last_used_at: null,
          created_at: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }

  return ok({ transaction: updated, rule });
});
