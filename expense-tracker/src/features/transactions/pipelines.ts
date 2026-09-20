import type { Document, Filter } from 'mongodb';
import type { z } from 'zod';
import { monthRange } from '@/lib/date';
import type { transactionFilterSchema } from './schema';

/** Pure pipeline builders, so the query logic can be tested without a server. */

export type TransactionFilter = z.infer<typeof transactionFilterSchema>;

export const TRANSACTION_LOOKUPS: Document[] = [
  { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: '__c' } },
  { $lookup: { from: 'accounts', localField: 'account_id', foreignField: '_id', as: '__a' } },
  { $lookup: { from: 'people', localField: 'person_id', foreignField: '_id', as: '__p' } },
  {
    $addFields: {
      category_name: { $first: '$__c.name' },
      category_color: { $first: '$__c.color' },
      category_icon: { $first: '$__c.icon' },
      account_name: { $first: '$__a.name' },
      person_name: { $first: '$__p.name' },
    },
  },
  { $project: { __c: 0, __a: 0, __p: 0 } },
];

/**
 * Builds the query shared by the rows and the totals.
 *
 * An ignored row is a mistake, a refund or a duplicate the user rejected. It
 * stays in the collection for the audit trail but never counts as money, so
 * the exclusion lives here rather than in each caller.
 */
export function buildFilter(userId: string, f: TransactionFilter): Filter<Document> {
  const filter: Record<string, unknown> = {
    user_id: userId,
    status: { $ne: 'ignored' },
  };
  const dateRange: Record<string, string> = {};

  if (f.month) {
    const { start, end } = monthRange(f.month);
    dateRange.$gte = start;
    dateRange.$lte = end;
  }
  if (f.from) dateRange.$gte = f.from;
  if (f.to) dateRange.$lte = f.to;
  if (Object.keys(dateRange).length) filter.txn_date = dateRange;

  if (f.type) filter.type = f.type;
  if (f.bucket) filter.bucket = f.bucket;
  if (f.need_level) filter.need_level = f.need_level;
  if (f.status) filter.status = f.status;
  if (f.source) filter.source = f.source;
  if (f.category_id) filter.category_id = f.category_id;
  if (f.person_id) filter.person_id = f.person_id;
  if (f.account_id) {
    filter.$or = [{ account_id: f.account_id }, { to_account_id: f.account_id }];
  }
  if (f.q) {
    // Escaped, so a search for "a.b" cannot be read as a pattern.
    const safe = f.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const like = { $regex: safe, $options: 'i' };
    const search = [{ merchant: like }, { note: like }];
    filter.$and = [{ $or: search }];
  }

  return filter as Filter<Document>;
}


/** The page and its totals in one round trip, as the two SQL queries did. */
export function listTransactionsPipeline(
  userId: string,
  filter: TransactionFilter,
): Document[] {
  return [
    { $match: buildFilter(userId, filter) },
    {
      $facet: {
        rows: [
          { $sort: { txn_date: -1, created_at: -1 } },
          { $skip: filter.offset },
          { $limit: filter.limit },
          ...TRANSACTION_LOOKUPS,
        ],
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
              expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
            },
          },
        ],
      },
    },
  ];
}
