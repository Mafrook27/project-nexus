import { one } from '@/server/db/client';
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
  const row = await one(
    `INSERT INTO transactions
       (user_id, type, bucket, need_level, amount, txn_date, transaction_at,
        account_id, to_account_id, category_id, person_id, merchant, note)
     VALUES ($1,$2,$3,$4,$5,$6,
             -- A typed-in entry has a day but no clock. Midday keeps it inside
             -- its own date and lets deduplication compare it like any other.
             $6::date + time '12:00',
             $7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      user.id,
      d.type,
      d.bucket,
      d.need_level,
      d.amount,
      d.txn_date,
      d.account_id ?? null,
      d.to_account_id ?? null,
      d.category_id ?? null,
      d.person_id ?? null,
      d.merchant ?? null,
      d.note ?? null,
    ],
  );
  return ok(row, 201);
});
