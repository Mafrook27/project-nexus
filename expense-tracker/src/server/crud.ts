import 'server-only';
import type { Document, Filter } from 'mongodb';
import type { ZodType } from 'zod';
import { col, newId, type AnyDoc, type CollectionName } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
import { HttpError, notFound, ok, readJson, route } from '@/server/http';

/**
 * Most of this app is "a collection scoped to the signed-in user". Rather than
 * writing the same four handlers thirteen times, each feature describes its
 * collection once and gets REST endpoints for free. Features with real logic
 * (transactions, dashboard, sync) write their own services instead.
 */
export type CrudConfig = {
  collection: CollectionName;
  /** Fields a client is allowed to write. Never taken from the request. */
  columns: string[];
  createSchema: ZodType;
  updateSchema: ZodType;
  /** Sort for the list endpoint. */
  sort?: Document;
  /** Aggregation pipeline for lists that need joined names. */
  listPipeline?: (userId: string) => Document[];
  /** Extra fields stamped on insert, e.g. counters that start at zero. */
  defaults?: Record<string, unknown>;
};

const pick = (data: Record<string, unknown>, columns: string[]) => {
  const out: Record<string, unknown> = {};
  for (const key of columns) if (data[key] !== undefined) out[key] = data[key];
  return out;
};

export function collectionRoutes(cfg: CrudConfig) {
  const GET = route(async () => {
    const user = await requireUser();
    if (cfg.listPipeline) {
      return ok(await col<AnyDoc>(cfg.collection).aggregate(cfg.listPipeline(user.id)).toArray());
    }
    const rows = await col<AnyDoc>(cfg.collection)
      .find({ user_id: user.id })
      .sort(cfg.sort ?? { created_at: -1 })
      .toArray();
    return ok(rows);
  });

  const POST = route(async (req: Request) => {
    const user = await requireUser();
    const data = cfg.createSchema.parse(await readJson(req)) as Record<string, unknown>;
    const doc = {
      _id: newId(),
      user_id: user.id,
      ...cfg.defaults,
      ...pick(data, cfg.columns),
      created_at: new Date(),
    };
    try {
      await col<AnyDoc>(cfg.collection).insertOne(doc);
    } catch (err) {
      throw asConflict(err);
    }
    return ok(doc, 201);
  });

  return { GET, POST };
}

type Ctx = { params: Promise<{ id: string }> };

export function itemRoutes(cfg: CrudConfig) {
  const GET = route(async (_req: Request, ctx: Ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const row = await col<AnyDoc>(cfg.collection).findOne({ _id: id, user_id: user.id });
    if (!row) throw notFound();
    return ok(row);
  });

  const PATCH = route(async (req: Request, ctx: Ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const data = cfg.updateSchema.parse(await readJson(req)) as Record<string, unknown>;
    const changes = pick(data, cfg.columns);
    if (!Object.keys(changes).length) throw new HttpError(400, 'Nothing to update');

    let row;
    try {
      row = await col<AnyDoc>(cfg.collection).findOneAndUpdate(
        { _id: id, user_id: user.id },
        { $set: { ...changes, updated_at: new Date() } },
        { returnDocument: 'after' },
      );
    } catch (err) {
      throw asConflict(err);
    }
    if (!row) throw notFound();
    return ok(row);
  });

  const DELETE = route(async (_req: Request, ctx: Ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const result = await col<AnyDoc>(cfg.collection).deleteOne({ _id: id, user_id: user.id });
    if (!result.deletedCount) throw notFound();
    await applyCascades(cfg.collection, user.id, id);
    return ok({ ok: true });
  });

  return { GET, PATCH, DELETE };
}

/** Turns a duplicate-key error into a readable 409 instead of a 500. */
function asConflict(err: unknown): unknown {
  const code = (err as { code?: number })?.code;
  if (code === 11000) return new HttpError(409, 'That already exists');
  return err;
}

// ---------------------------------------------------------------------------
// What ON DELETE used to do for free.
//
// Postgres enforced this in the engine: deleting a category set category_id to
// null on its transactions and removed its budgets. MongoDB has no foreign
// keys, so it has to be written out - and it has to actually be written out,
// because the alternative is dangling ids that render as blank names and
// totals that quietly stop adding up.
// ---------------------------------------------------------------------------

type Cascade = {
  collection: CollectionName;
  /** Null the reference, the old ON DELETE SET NULL. */
  unset?: string[];
  /** Remove the row entirely, the old ON DELETE CASCADE. */
  remove?: string;
};

const CASCADES: Partial<Record<CollectionName, Cascade[]>> = {
  people: [
    { collection: 'accounts', unset: ['person_id'] },
    { collection: 'transactions', unset: ['person_id'] },
    { collection: 'investments', unset: ['person_id'] },
    { collection: 'sips', unset: ['person_id'] },
    { collection: 'liabilities', unset: ['person_id'] },
  ],
  accounts: [
    { collection: 'transactions', unset: ['account_id', 'to_account_id'] },
    { collection: 'recurring', unset: ['account_id'] },
  ],
  categories: [
    { collection: 'transactions', unset: ['category_id'] },
    { collection: 'recurring', unset: ['category_id'] },
    { collection: 'budgets', remove: 'category_id' },
    { collection: 'merchant_rules', remove: 'category_id' },
  ],
  investments: [{ collection: 'sips', unset: ['investment_id'] }],
};

export async function applyCascades(
  deleted: CollectionName,
  userId: string,
  id: string,
): Promise<void> {
  for (const rule of CASCADES[deleted] ?? []) {
    if (rule.remove) {
      await col<AnyDoc>(rule.collection).deleteMany({
        user_id: userId,
        [rule.remove]: id,
      } as Filter<AnyDoc>);
    }
    for (const field of rule.unset ?? []) {
      await col<AnyDoc>(rule.collection).updateMany({ user_id: userId, [field]: id } as Filter<AnyDoc>, {
        $set: { [field]: null },
      });
    }
  }
}

/** Deleting an account removes everything belonging to it. */
export async function deleteUserData(userId: string): Promise<void> {
  const owned: CollectionName[] = [
    'people',
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'investments',
    'sips',
    'liabilities',
    'recurring',
    'goals',
    'net_worth_snapshots',
    'devices',
    'merchant_rules',
  ];
  for (const name of owned) {
    await col<AnyDoc>(name).deleteMany({ user_id: userId });
  }
  await col<AnyDoc>('users').deleteOne({ _id: userId });
}
