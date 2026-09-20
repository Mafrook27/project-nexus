import { requireUser } from '@/features/auth/session';
import { transaction } from '@/server/db/client';
import { ok, readJson, route } from '@/server/http';
import { holdingImportSchema } from '@/features/investments/schema';

export const runtime = 'nodejs';

/**
 * Upserts stock holdings from a broker CSV. Matching is by symbol so
 * re-uploading a fresh export just refreshes prices instead of duplicating.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const payload = holdingImportSchema.parse(await readJson(req));

  const result = await transaction(async (q) => {
    if (payload.replace) {
      await q(`DELETE FROM investments WHERE user_id = $1 AND type = 'stock'`, [user.id]);
    }
    let inserted = 0;
    let updated = 0;
    for (const row of payload.rows) {
      const symbol = row.symbol.trim().toUpperCase();
      const invested = row.units * row.avg_price;
      const lastPrice = row.last_price && row.last_price > 0 ? row.last_price : row.avg_price;
      const current = row.units * lastPrice;

      const [existing] = await q<{ id: string }>(
        `SELECT id FROM investments WHERE user_id = $1 AND type = 'stock' AND UPPER(symbol) = $2`,
        [user.id, symbol],
      );
      if (existing) {
        await q(
          `UPDATE investments SET units = $2, avg_price = $3, last_price = $4,
             invested = $5, current_value = $6, person_id = COALESCE($7, person_id),
             updated_at = now()
           WHERE id = $1`,
          [existing.id, row.units, row.avg_price, lastPrice, invested, current, payload.person_id ?? null],
        );
        updated++;
      } else {
        await q(
          `INSERT INTO investments
             (user_id, person_id, name, type, symbol, units, avg_price, last_price,
              invested, current_value, liquid)
           VALUES ($1,$2,$3,'stock',$4,$5,$6,$7,$8,$9,true)`,
          [
            user.id,
            payload.person_id ?? null,
            row.name?.trim() || symbol,
            symbol,
            row.units,
            row.avg_price,
            lastPrice,
            invested,
            current,
          ],
        );
        inserted++;
      }
    }
    return { inserted, updated };
  });

  return ok(result, 201);
});
