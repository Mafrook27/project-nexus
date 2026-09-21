import { investments, transactions } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
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
      ? await investments()
          .aggregate<Record<string, unknown>>([
            { $match: { user_id: user.id } },
            { $lookup: { from: 'people', localField: 'person_id', foreignField: '_id', as: '__p' } },
            {
              $project: {
                _id: 0,
                name: 1,
                type: 1,
                symbol: 1,
                units: 1,
                avg_price: 1,
                last_price: 1,
                invested: 1,
                current_value: 1,
                liquid: 1,
                owner: { $first: '$__p.name' },
              },
            },
            { $sort: { name: 1 } },
          ])
          .toArray()
      : await transactions()
          .aggregate<Record<string, unknown>>([
            { $match: { user_id: user.id } },
            { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: '__c' } },
            { $lookup: { from: 'accounts', localField: 'account_id', foreignField: '_id', as: '__a' } },
            { $lookup: { from: 'people', localField: 'person_id', foreignField: '_id', as: '__p' } },
            {
              $project: {
                _id: 0,
                txn_date: 1,
                type: 1,
                bucket: 1,
                need_level: 1,
                amount: 1,
                category: { $first: '$__c.name' },
                account: { $first: '$__a.name' },
                person: { $first: '$__p.name' },
                merchant: 1,
                reason: 1,
                note: 1,
                source: 1,
                status: 1,
              },
            },
            { $sort: { txn_date: -1 } },
          ])
          .toArray();

  const today = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="paisa-${what}-${today}.csv"`,
    },
  });
});
