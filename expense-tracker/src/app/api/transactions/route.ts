import { newId, money, transactions, type TransactionDoc } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
import { ok, readJson, route, searchParams } from '@/server/http';
import { listTransactions } from '@/features/transactions/service';
import { transactionFilterSchema, transactionSchema } from '@/features/transactions/schema';

export const runtime = 'nodejs';

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const filter = transactionFilterSchema.parse(Object.fromEntries(searchParams(req)));
  return ok(await listTransactions(user.id, filter));
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const d = transactionSchema.parse(await readJson(req));
  const now = new Date();
  const doc = {
    _id: newId(),
    user_id: user.id,
    // zEnum builds the list from the shared constants at runtime, so zod
    // widens these to string. The values themselves are already validated.
    type: d.type as TransactionDoc['type'],
    bucket: d.bucket as TransactionDoc['bucket'],
    need_level: d.need_level as TransactionDoc['need_level'],
    amount: money(d.amount),
    txn_date: d.txn_date,
    // A typed-in entry has a day but no clock. Midday keeps it inside its own
    // date and lets deduplication compare it like any other.
    transaction_at: new Date(`${d.txn_date}T12:00:00`),
    account_id: d.account_id ?? null,
    to_account_id: d.to_account_id ?? null,
    category_id: d.category_id ?? null,
    person_id: d.person_id ?? null,
    merchant: d.merchant ?? null,
    note: d.note ?? null,
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
  await transactions().insertOne(doc);
  return ok(doc, 201);
});
