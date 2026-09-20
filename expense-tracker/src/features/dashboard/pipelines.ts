import type { Document } from 'mongodb';
import { monthRange } from '@/lib/date';

/**
 * The dashboard's aggregation, as a pure function.
 *
 * Nine of the thirteen SQL queries collapse into one pass over this user's
 * last twelve months: `$facet` runs every branch against the same input, so
 * the collection is scanned once rather than nine times.
 */

/** An ignored row is not money. Every aggregate below starts from this. */
export const real = (userId: string) => ({ user_id: userId, status: { $ne: 'ignored' } });

const between = (start: string, end: string) => ({ txn_date: { $gte: start, $lte: end } });

/** `SUM(CASE WHEN … THEN amount ELSE 0 END)`, in pipeline form. */
const sumWhen = (cond: Document): Document => ({ $sum: { $cond: [cond, '$amount', 0] } });

export function dashboardFacet(
  userId: string,
  range: { start: string; end: string; prevStart: string; prevEnd: string; trendStart: string },
): Document[] {
  const { start, end, prevStart, prevEnd, trendStart } = range;
  return [
        { $match: { ...real(userId), txn_date: { $gte: trendStart, $lte: end } } },
        {
          $facet: {
            month: [{ $match: between(start, end) }, { $group: monthTotals() }],
            prevMonth: [{ $match: between(prevStart, prevEnd) }, { $group: monthTotals() }],
            byCategory: [
              { $match: { ...between(start, end), type: 'expense', category_id: { $ne: null } } },
              { $group: { _id: '$category_id', amount: { $sum: '$amount' } } },
              { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: '__c' } },
              {
                $project: {
                  _id: 0,
                  id: '$_id',
                  amount: 1,
                  name: { $first: '$__c.name' },
                  color: { $first: '$__c.color' },
                  bucket: { $first: '$__c.bucket' },
                },
              },
              { $sort: { amount: -1 } },
            ],
            trend: [
              {
                $group: {
                  _id: { $substr: ['$txn_date', 0, 7] },
                  income: sumWhen({ $eq: ['$type', 'income'] }),
                  expense: sumWhen({ $eq: ['$type', 'expense'] }),
                  home: sumWhen({
                    $and: [{ $eq: ['$type', 'expense'] }, { $eq: ['$bucket', 'home'] }],
                  }),
                  personal: sumWhen({
                    $and: [{ $eq: ['$type', 'expense'] }, { $eq: ['$bucket', 'personal'] }],
                  }),
                  need: sumWhen({
                    $and: [{ $eq: ['$type', 'expense'] }, { $eq: ['$need_level', 'need'] }],
                  }),
                  want: sumWhen({
                    $and: [{ $eq: ['$type', 'expense'] }, { $eq: ['$need_level', 'want'] }],
                  }),
                  waste: sumWhen({
                    $and: [{ $eq: ['$type', 'expense'] }, { $eq: ['$need_level', 'waste'] }],
                  }),
                },
              },
              { $project: { _id: 0, month: '$_id', income: 1, expense: 1, home: 1, personal: 1, need: 1, want: 1, waste: 1 } },
              { $sort: { month: 1 } },
            ],
            needSplit: [
              { $match: { ...between(start, end), type: 'expense' } },
              { $group: { _id: '$need_level', amount: { $sum: '$amount' } } },
              { $project: { _id: 0, need_level: '$_id', amount: 1 } },
            ],
            wasteCategories: [
              { $match: { ...between(start, end), type: 'expense', need_level: 'waste' } },
              { $group: { _id: '$category_id', amount: { $sum: '$amount' }, n: { $sum: 1 } } },
              { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: '__c' } },
              {
                $project: {
                  _id: 0,
                  amount: 1,
                  n: 1,
                  name: { $ifNull: [{ $first: '$__c.name' }, 'Uncategorised'] },
                  color: { $ifNull: [{ $first: '$__c.color' }, '#94A3B8'] },
                },
              },
              { $sort: { amount: -1 } },
              { $limit: 5 },
            ],
            topMerchants: [
              { $match: { ...between(start, end), type: 'expense' } },
              {
                $group: {
                  _id: {
                    $ifNull: [
                      { $cond: [{ $eq: ['$merchant', ''] }, null, '$merchant'] },
                      'Uncategorised',
                    ],
                  },
                  amount: { $sum: '$amount' },
                  n: { $sum: 1 },
                },
              },
              { $project: { _id: 0, merchant: '$_id', amount: 1, n: 1 } },
              { $sort: { amount: -1 } },
              { $limit: 5 },
            ],
            needsAttention: [
              { $match: { status: 'detected' } },
              { $sort: { transaction_at: -1 } },
              { $limit: 4 },
              {
                $project: {
                  _id: 0,
                  id: '$_id',
                  amount: 1,
                  merchant: 1,
                  transaction_at: 1,
                  source: 1,
                },
              },
            ],
            budgetSpend: [
              { $match: { ...between(start, end), type: 'expense', category_id: { $ne: null } } },
              { $group: { _id: '$category_id', spent: { $sum: '$amount' } } },
            ],
          },
        },
  ];
}

export function monthTotals(): Document {
  return {
    _id: null,
    income: sumWhen({ $eq: ['$type', 'income'] }),
    expense: sumWhen({ $eq: ['$type', 'expense'] }),
    home: sumWhen({ $and: [{ $eq: ['$type', 'expense'] }, { $eq: ['$bucket', 'home'] }] }),
    personal: sumWhen({ $and: [{ $eq: ['$type', 'expense'] }, { $eq: ['$bucket', 'personal'] }] }),
    // Money moved to savings shows up as a transfer.
    invested: sumWhen({ $eq: ['$type', 'transfer'] }),
  };
}
