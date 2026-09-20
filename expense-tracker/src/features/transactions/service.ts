import 'server-only';
import { z } from 'zod';
import { query } from '@/server/db/client';
import { monthRange } from '@/lib/date';
import { transactionFilterSchema, type Transaction } from './schema';

const SELECT = `
  SELECT t.*,
         c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
         a.name AS account_name,
         p.name AS person_name
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN accounts   a ON a.id = t.account_id
  LEFT JOIN people     p ON p.id = t.person_id
`;

export type TransactionFilter = z.infer<typeof transactionFilterSchema>;

/** Builds the WHERE clause shared by the list and the totals query. */
function buildWhere(userId: string, f: TransactionFilter) {
  const where: string[] = ['t.user_id = $1'];
  const params: unknown[] = [userId];
  /** Registers a value and returns its placeholder, e.g. `$3`. */
  const p = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (f.month) {
    const { start, end } = monthRange(f.month);
    where.push(`t.txn_date >= ${p(start)}`, `t.txn_date <= ${p(end)}`);
  }
  if (f.from) where.push(`t.txn_date >= ${p(f.from)}`);
  if (f.to) where.push(`t.txn_date <= ${p(f.to)}`);
  if (f.type) where.push(`t.type = ${p(f.type)}`);
  if (f.bucket) where.push(`t.bucket = ${p(f.bucket)}`);
  if (f.category_id) where.push(`t.category_id = ${p(f.category_id)}`);
  if (f.person_id) where.push(`t.person_id = ${p(f.person_id)}`);
  if (f.account_id) {
    where.push(`(t.account_id = ${p(f.account_id)} OR t.to_account_id = ${p(f.account_id)})`);
  }
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(`(t.merchant ILIKE ${p(like)} OR t.note ILIKE ${p(like)})`);
  }

  return { clause: where.join(' AND '), params };
}

export async function listTransactions(userId: string, filter: TransactionFilter) {
  const { clause, params } = buildWhere(userId, filter);
  const rows = await query<Transaction>(
    `${SELECT} WHERE ${clause}
     ORDER BY t.txn_date DESC, t.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filter.limit, filter.offset],
  );
  const [{ count, income, expense }] = await query<{
    count: number;
    income: number;
    expense: number;
  }>(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense
     FROM transactions t WHERE ${clause}`,
    params,
  );
  return { rows, count, income, expense };
}

export async function getTransaction(userId: string, id: string) {
  const rows = await query<Transaction>(`${SELECT} WHERE t.user_id = $1 AND t.id = $2`, [
    userId,
    id,
  ]);
  return rows[0] ?? null;
}
