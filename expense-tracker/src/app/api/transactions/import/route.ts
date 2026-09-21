import { categories, money, newId, transactions } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
import { ok, readJson, route } from '@/server/http';
import { importPayloadSchema } from '@/features/import/schema';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const payload = importPayloadSchema.parse(await readJson(req));

  const existing = await categories().find({ user_id: user.id }).toArray();
  const key = (name: string, kind: string) => `${name.trim().toLowerCase()}|${kind}`;
  const map = new Map(existing.map((c) => [key(c.name, c.kind), c._id]));

  const docs = [];
  let categoriesCreated = 0;
  const now = new Date();

  for (const row of payload.rows) {
    let categoryId: string | null = null;
    if (row.category) {
      const kind = row.type === 'income' ? 'income' : 'expense';
      categoryId = map.get(key(row.category, kind)) ?? null;
      if (!categoryId && payload.create_missing_categories && row.type !== 'transfer') {
        const created = await categories().findOneAndUpdate(
          { user_id: user.id, name: row.category.trim(), kind },
          {
            $setOnInsert: {
              _id: newId(),
              user_id: user.id,
              name: row.category.trim(),
              kind,
              bucket: row.bucket,
              default_need_level: kind === 'income' ? 'need' : 'want',
              icon: 'Circle',
              color: '#64748B',
              created_at: now,
            },
          },
          { upsert: true, returnDocument: 'after' },
        );
        if (created) {
          categoryId = created._id;
          map.set(key(row.category, kind), created._id);
          categoriesCreated++;
        }
      }
    }

    docs.push({
      _id: newId(),
      user_id: user.id,
      account_id: payload.account_id ?? null,
      to_account_id: null,
      category_id: categoryId,
      person_id: payload.person_id ?? null,
      type: row.type,
      bucket: row.bucket,
      need_level: 'need' as const,
      amount: money(Math.abs(row.amount)),
      txn_date: row.txn_date,
      transaction_at: new Date(`${row.txn_date}T12:00:00`),
      merchant: row.merchant ?? null,
      note: row.note ?? null,
      reason: null,
      source: 'import' as const,
      status: 'confirmed' as const,
      payment_method: 'unknown',
      bank: null,
      account_last4: null,
      raw_reference: null,
      raw_message: null,
      created_at: now,
      updated_at: now,
    });
  }

  if (docs.length) await transactions().insertMany(docs, { ordered: false });
  return ok({ created: docs.length, categoriesCreated }, 201);
});
