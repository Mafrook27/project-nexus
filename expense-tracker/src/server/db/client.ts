import { Pool, types } from 'pg';

// Postgres returns numeric/int8 as strings to protect precision. Money in this
// app never exceeds JS safe-integer range, so parse them into numbers once here
// instead of sprinkling Number(...) across every feature.
types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric
types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // int8
types.setTypeParser(1082, (v) => v); // date -> keep 'YYYY-MM-DD' string

declare global {
  // eslint-disable-next-line no-var
  var __paisaPool: Pool | undefined;
}

let cached: Pool | undefined = globalThis.__paisaPool;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Neon, Supabase and Render all require TLS; their certs are not in the
    // Node trust store, so verification is relaxed the way their own guides do.
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
}

/**
 * The pool is created on first use, not at import time, so a build (or a
 * `next build` on a machine with no database) never fails just by loading a
 * route file. Next.js hot-reloads modules in dev, so it is cached globally to
 * avoid exhausting the free tier's connection limit.
 */
export function getPool(): Pool {
  if (!cached) {
    cached = createPool();
    if (process.env.NODE_ENV !== 'production') globalThis.__paisaPool = cached;
  }
  return cached;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (q: typeof query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const scoped = async <R>(text: string, params: unknown[] = []) => {
      const res = await client.query(text, params as never[]);
      return res.rows as R[];
    };
    const result = await fn(scoped as typeof query);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Closes the pool. Only the CLI scripts need this. */
export async function closePool(): Promise<void> {
  await cached?.end();
  cached = undefined;
  globalThis.__paisaPool = undefined;
}
