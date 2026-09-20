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
       (user_id, type, bucket, amount, txn_date, account_id, to_account_id,
        category_id, person_id, merchant, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      user.id,
      d.type,
      d.bucket,
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
