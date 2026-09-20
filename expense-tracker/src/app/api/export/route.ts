import { requireUser } from '@/features/auth/session';
import { query } from '@/server/db/client';
import { route, searchParams } from '@/server/http';

export const runtime = 'nodejs';

const escape = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n');
};

/** Your data, in a spreadsheet, whenever you want it. */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const what = searchParams(req).get('type') ?? 'transactions';

  const rows =
    what === 'investments'
      ? await query(
          `SELECT i.name, i.type, i.symbol, i.units, i.avg_price, i.last_price,
                  i.invested, i.current_value, i.liquid, p.name AS owner
           FROM investments i LEFT JOIN people p ON p.id = i.person_id
           WHERE i.user_id = $1 ORDER BY i.name`,
          [user.id],
        )
      : await query(
          `SELECT t.txn_date, t.type, t.bucket, t.amount, c.name AS category,
                  a.name AS account, p.name AS person, t.merchant, t.note
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
           LEFT JOIN accounts a ON a.id = t.account_id
           LEFT JOIN people p ON p.id = t.person_id
           WHERE t.user_id = $1 ORDER BY t.txn_date DESC`,
          [user.id],
        );

  const today = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows as Record<string, unknown>[]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="paisa-${what}-${today}.csv"`,
    },
  });
});
