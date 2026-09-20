import { requireUser } from '@/features/auth/session';
import { query } from '@/server/db/client';
import { ok, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Everything waiting for an answer, newest first, plus the shortlist of
 *  categories worth offering as one-tap chips. */
export const GET = route(async () => {
  const user = await requireUser();

  const [rows, topCategories] = await Promise.all([
    query(
      `SELECT t.*, c.name AS category_name, c.color AS category_color, a.name AS account_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN accounts   a ON a.id = t.account_id
       WHERE t.user_id = $1 AND t.status = 'detected'
       ORDER BY t.transaction_at DESC NULLS LAST
       LIMIT 100`,
      [user.id],
    ),
    // Offering all twenty categories as chips makes the card unreadable. These
    // are the ones this person actually uses, which covers almost every spend
    // in one tap; the rest stay one dropdown away.
    query<{ id: string }>(
      `SELECT c.id
       FROM categories c
       LEFT JOIN transactions t
         ON t.category_id = c.id
        AND t.status <> 'ignored'
        AND t.txn_date > CURRENT_DATE - 90
       WHERE c.user_id = $1 AND c.kind = 'expense'
       GROUP BY c.id, c.name
       ORDER BY COUNT(t.id) DESC, c.name ASC
       LIMIT 6`,
      [user.id],
    ),
  ]);

  return ok({ rows, count: rows.length, topCategoryIds: topCategories.map((c) => c.id) });
});
