import { categories, transactions } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
import { ok, route } from '@/server/http';
import { TRANSACTION_LOOKUPS } from '@/features/transactions/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Everything waiting for an answer, plus the categories worth offering as chips. */
export const GET = route(async () => {
  const user = await requireUser();

  const [rows, topCategories] = await Promise.all([
    transactions()
      .aggregate([
        { $match: { user_id: user.id, status: 'detected' } },
        { $sort: { transaction_at: -1 } },
        { $limit: 100 },
        ...TRANSACTION_LOOKUPS,
        { $addFields: { id: '$_id' } },
      ])
      .toArray(),
    // Offering all twenty categories as chips makes the card unreadable. These
    // are the ones this person actually uses.
    categories()
      .aggregate<{ _id: string }>([
        { $match: { user_id: user.id, kind: 'expense' } },
        {
          $lookup: {
            from: 'transactions',
            let: { catId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$category_id', '$$catId'] },
                      { $ne: ['$status', 'ignored'] },
                    ],
                  },
                },
              },
              { $count: 'n' },
            ],
            as: '__used',
          },
        },
        { $addFields: { uses: { $ifNull: [{ $first: '__used.n' }, 0] } } },
        { $sort: { uses: -1, name: 1 } },
        { $limit: 6 },
        { $project: { _id: 1 } },
      ])
      .toArray(),
  ]);

  return ok({
    rows,
    count: rows.length,
    topCategoryIds: topCategories.map((c) => c._id),
  });
});
