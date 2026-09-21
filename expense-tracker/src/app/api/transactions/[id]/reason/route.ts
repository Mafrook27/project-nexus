import { transactions } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
import { reasonSchema } from '@/features/transactions/intelligence/schema';
import { notFound, ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';

/** Just the "why", for when the category was already right. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { reason } = reasonSchema.parse(await readJson(req));

  const row = await transactions().findOneAndUpdate(
    { _id: id, user_id: user.id },
    { $set: { reason: reason ?? null, updated_at: new Date() } },
    { returnDocument: 'after' },
  );
  if (!row) throw notFound('Transaction not found');
  return ok(row);
});
