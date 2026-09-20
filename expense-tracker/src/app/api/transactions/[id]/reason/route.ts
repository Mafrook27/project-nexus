import { one } from '@/server/db/client';
import { requireUser } from '@/features/auth/session';
import { reasonSchema } from '@/features/transactions/intelligence/schema';
import { notFound, ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';

/** Just the "why", for when the category was already right. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { reason } = reasonSchema.parse(await readJson(req));

  const row = await one(
    `UPDATE transactions SET reason = $3, updated_at = now()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, user.id, reason ?? null],
  );
  if (!row) throw notFound('Transaction not found');
  return ok(row);
});
