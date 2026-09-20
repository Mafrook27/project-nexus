import 'server-only';
import type { ZodType } from 'zod';
import { query, one } from '@/server/db/client';
import { requireUser } from '@/features/auth/session';
import { HttpError, notFound, ok, readJson, route } from '@/server/http';

/**
 * Most of this app is "a table scoped to the signed-in user". Rather than
 * writing the same four handlers eleven times, each feature describes its table
 * once and gets REST endpoints for free. Features with real logic
 * (transactions, dashboard, fire) write their own services instead.
 */
export type CrudConfig = {
  /** Table name. Never interpolated from user input. */
  table: string;
  /** Columns a client is allowed to write. */
  columns: string[];
  createSchema: ZodType;
  updateSchema: ZodType;
  /** SQL ORDER BY clause used by the list endpoint. */
  orderBy?: string;
  /** Optional extra SELECT (e.g. joins) used by the list endpoint. */
  listSql?: (userId: string) => { text: string; params: unknown[] };
  /** Runs after a successful write - handy for recomputing derived values. */
  afterWrite?: (userId: string, row: Record<string, unknown>) => Promise<void>;
};

const pick = (data: Record<string, unknown>, columns: string[]) =>
  columns.filter((c) => data[c] !== undefined).map((c) => [c, data[c]] as const);

export function collectionRoutes(cfg: CrudConfig) {
  const GET = route(async (req: Request) => {
    const user = await requireUser();
    if (cfg.listSql) {
      const { text, params } = cfg.listSql(user.id);
      return ok(await query(text, params));
    }
    const order = cfg.orderBy ?? 'created_at DESC';
    return ok(
      await query(`SELECT * FROM ${cfg.table} WHERE user_id = $1 ORDER BY ${order}`, [user.id]),
    );
  });

  const POST = route(async (req: Request) => {
    const user = await requireUser();
    const data = cfg.createSchema.parse(await readJson(req)) as Record<string, unknown>;
    const entries = pick(data, cfg.columns);
    const cols = ['user_id', ...entries.map(([c]) => c)];
    const values = [user.id, ...entries.map(([, v]) => v)];
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const row = await one<Record<string, unknown>>(
      `INSERT INTO ${cfg.table} (${cols.join(', ')})
       VALUES (${placeholders.join(', ')}) RETURNING *`,
      values,
    );
    if (row && cfg.afterWrite) await cfg.afterWrite(user.id, row);
    return ok(row, 201);
  });

  return { GET, POST };
}

type Ctx = { params: Promise<{ id: string }> };

export function itemRoutes(cfg: CrudConfig) {
  const GET = route(async (_req: Request, ctx: Ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const row = await one(`SELECT * FROM ${cfg.table} WHERE id = $1 AND user_id = $2`, [id, user.id]);
    if (!row) throw notFound();
    return ok(row);
  });

  const PATCH = route(async (req: Request, ctx: Ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const data = cfg.updateSchema.parse(await readJson(req)) as Record<string, unknown>;
    const entries = pick(data, cfg.columns);
    if (!entries.length) throw new HttpError(400, 'Nothing to update');
    const sets = entries.map(([c], i) => `${c} = $${i + 3}`);
    const row = await one<Record<string, unknown>>(
      `UPDATE ${cfg.table} SET ${sets.join(', ')}
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, user.id, ...entries.map(([, v]) => v)],
    );
    if (!row) throw notFound();
    if (cfg.afterWrite) await cfg.afterWrite(user.id, row);
    return ok(row);
  });

  const DELETE = route(async (_req: Request, ctx: Ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const row = await one(`DELETE FROM ${cfg.table} WHERE id = $1 AND user_id = $2 RETURNING id`, [
      id,
      user.id,
    ]);
    if (!row) throw notFound();
    return ok({ ok: true });
  });

  return { GET, PATCH, DELETE };
}
