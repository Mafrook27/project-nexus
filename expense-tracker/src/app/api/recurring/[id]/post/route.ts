import { money, newId, recurring, transactions } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
import { notFound, ok, route } from '@/server/http';
import { advanceDueDate } from '@/features/recurring/service';

export const runtime = 'nodejs';

/** Turns a due bill into a real transaction and rolls the due date forward. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const bill = await recurring().findOne({ _id: id, user_id: user.id });
  if (!bill) throw notFound('Bill not found');

  const now = new Date();
  const txn = {
    _id: newId(),
    user_id: user.id,
    account_id: bill.account_id,
    to_account_id: null,
    category_id: bill.category_id,
    person_id: null,
    type: bill.type,
    bucket: bill.bucket,
    need_level: 'need' as const,
    amount: money(bill.amount),
    txn_date: bill.next_due,
    transaction_at: new Date(`${bill.next_due}T12:00:00`),
    merchant: bill.name,
    note: 'Posted from recurring bill',
    reason: null,
    source: 'manual' as const,
    status: 'confirmed' as const,
    payment_method: 'unknown',
    bank: null,
    account_last4: null,
    raw_reference: null,
    raw_message: null,
    created_at: now,
    updated_at: now,
  };

  await transactions().insertOne(txn);
  const next = advanceDueDate(bill.next_due, bill.frequency);
  await recurring().updateOne({ _id: id, user_id: user.id }, { $set: { next_due: next } });

  return ok({ transaction: txn, next_due: next }, 201);
});
