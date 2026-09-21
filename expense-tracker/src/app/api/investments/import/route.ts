import { investments, money, newId } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
import { ok, readJson, route } from '@/server/http';
import { holdingImportSchema } from '@/features/investments/schema';

export const runtime = 'nodejs';

/**
 * Upserts stock holdings from a broker CSV. Matching is by symbol so
 * re-uploading a fresh export refreshes prices instead of duplicating.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const payload = holdingImportSchema.parse(await readJson(req));

  if (payload.replace) {
    await investments().deleteMany({ user_id: user.id, type: 'stock' });
  }

  let inserted = 0;
  let updated = 0;
  const now = new Date();

  for (const row of payload.rows) {
    const symbol = row.symbol.trim().toUpperCase();
    const lastPrice = row.last_price && row.last_price > 0 ? row.last_price : row.avg_price;

    const result = await investments().updateOne(
      // Case-insensitive so "infy" and "INFY" are one holding, matching the
      // old UPPER(symbol) comparison.
      { user_id: user.id, type: 'stock', symbol: { $regex: `^${escapeRegex(symbol)}$`, $options: 'i' } },
      {
        $set: {
          units: row.units,
          avg_price: row.avg_price,
          last_price: lastPrice,
          invested: money(row.units * row.avg_price),
          current_value: money(row.units * lastPrice),
          updated_at: now,
          ...(payload.person_id ? { person_id: payload.person_id } : {}),
        },
        $setOnInsert: {
          _id: newId(),
          user_id: user.id,
          name: row.name?.trim() || symbol,
          type: 'stock',
          symbol,
          person_id: payload.person_id ?? null,
          start_date: null,
          maturity_date: null,
          liquid: true,
          notes: null,
          created_at: now,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount) inserted++;
    else updated++;
  }

  return ok({ inserted, updated }, 201);
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
