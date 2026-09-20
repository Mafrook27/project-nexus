import 'server-only';
import { query } from '@/server/db/client';
import type { Account } from './schema';

/**
 * A balance is never stored - it is always opening_balance plus everything that
 * has moved through the account, so edits to old transactions stay correct.
 */
export const ACCOUNT_BALANCE_SQL = `
  a.opening_balance
  + COALESCE((
      SELECT SUM(CASE t.type WHEN 'income' THEN t.amount ELSE -t.amount END)
      FROM transactions t WHERE t.account_id = a.id AND t.status <> 'ignored'
    ), 0)
  + COALESCE((
      SELECT SUM(t.amount) FROM transactions t
      WHERE t.to_account_id = a.id AND t.type = 'transfer' AND t.status <> 'ignored'
    ), 0)
`;

export async function listAccounts(userId: string): Promise<Account[]> {
  return query<Account>(
    `SELECT a.*, p.name AS person_name, ${ACCOUNT_BALANCE_SQL} AS balance
     FROM accounts a
     LEFT JOIN people p ON p.id = a.person_id
     WHERE a.user_id = $1
     ORDER BY a.archived ASC, a.is_emergency DESC, a.name ASC`,
    [userId],
  );
}

export async function cashTotals(userId: string) {
  const rows = await query<{ total: number; emergency: number }>(
    `SELECT
       COALESCE(SUM(${ACCOUNT_BALANCE_SQL}), 0) AS total,
       COALESCE(SUM(CASE WHEN a.is_emergency THEN ${ACCOUNT_BALANCE_SQL} ELSE 0 END), 0) AS emergency
     FROM accounts a
     WHERE a.user_id = $1 AND a.archived = false AND a.type <> 'credit_card'`,
    [userId],
  );
  const cards = await query<{ dues: number }>(
    `SELECT COALESCE(SUM(-1 * (${ACCOUNT_BALANCE_SQL})), 0) AS dues
     FROM accounts a
     WHERE a.user_id = $1 AND a.archived = false AND a.type = 'credit_card'`,
    [userId],
  );
  return {
    cash: rows[0]?.total ?? 0,
    emergency: rows[0]?.emergency ?? 0,
    cardDues: Math.max(0, cards[0]?.dues ?? 0),
  };
}
