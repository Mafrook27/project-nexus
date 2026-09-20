import { requireUser } from '@/features/auth/session';
import { transaction } from '@/server/db/client';
import { ok, readJson, route } from '@/server/http';
import { importPayloadSchema } from '@/features/import/schema';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const payload = importPayloadSchema.parse(await readJson(req));

  const result = await transaction(async (q) => {
    const existing = await q<{ id: string; name: string; kind: string }>(
      'SELECT id, name, kind FROM categories WHERE user_id = $1',
      [user.id],
    );
    const key = (name: string, kind: string) => `${name.trim().toLowerCase()}|${kind}`;
    const map = new Map(existing.map((c) => [key(c.name, c.kind), c.id]));

    let created = 0;
    let categoriesCreated = 0;

    for (const row of payload.rows) {
      let categoryId: string | null = null;
      if (row.category) {
        const kind = row.type === 'income' ? 'income' : 'expense';
        categoryId = map.get(key(row.category, kind)) ?? null;
        if (!categoryId && payload.create_missing_categories && row.type !== 'transfer') {
          const [cat] = await q<{ id: string }>(
            `INSERT INTO categories (user_id, name, kind, bucket)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, name, kind) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [user.id, row.category.trim(), kind, row.bucket],
          );
          categoryId = cat.id;
          map.set(key(row.category, kind), cat.id);
          categoriesCreated++;
        }
      }

      await q(
        `INSERT INTO transactions
           (user_id, type, bucket, amount, txn_date, account_id, category_id, person_id, merchant, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          user.id,
          row.type,
          row.bucket,
          Math.abs(row.amount),
          row.txn_date,
          payload.account_id ?? null,
          categoryId,
          payload.person_id ?? null,
          row.merchant ?? null,
          row.note ?? null,
        ],
      );
      created++;
    }
    return { created, categoriesCreated };
  });

  return ok(result, 201);
});
