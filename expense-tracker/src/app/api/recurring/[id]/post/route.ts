import { one, transaction } from '@/server/db/client';
import { requireUser } from '@/features/auth/session';
import { notFound, ok, route } from '@/server/http';
import { advanceDueDate } from '@/features/recurring/service';

export const runtime = 'nodejs';

/** Turns a due bill into a real transaction and rolls the due date forward. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const bill = await one<{
    id: string;
    name: string;
    amount: number;
    type: string;
    bucket: string;
    frequency: string;
    next_due: string;
    account_id: string | null;
    category_id: string | null;
  }>('SELECT * FROM recurring WHERE id = $1 AND user_id = $2', [id, user.id]);
  if (!bill) throw notFound('Bill not found');

  return transaction(async (q) => {
    const [txn] = await q(
      `INSERT INTO transactions
         (user_id, type, bucket, amount, txn_date, account_id, category_id, merchant, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        user.id,
        bill.type,
        bill.bucket,
        bill.amount,
        bill.next_due,
        bill.account_id,
        bill.category_id,
        bill.name,
        'Posted from recurring bill',
      ],
    );
    const next = advanceDueDate(bill.next_due, bill.frequency);
    await q('UPDATE recurring SET next_due = $1 WHERE id = $2 AND user_id = $3', [
      next,
      id,
      user.id,
    ]);
    return ok({ transaction: txn, next_due: next }, 201);
  });
});
