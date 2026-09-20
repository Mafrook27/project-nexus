import type { Document } from 'mongodb';

/**
 * Pure pipeline builders. No connection, no `server-only`, so the aggregation
 * logic can be executed against fixtures in a test instead of being taken on
 * trust. The services in service.ts run these against the real database.
 */

/**
 * A balance is never stored. It is the opening balance plus everything that has
 * moved through the account, so editing a four-month-old transaction still
 * corrects every screen.
 *
 * In SQL this was a correlated subquery. Here it is a `$lookup` carrying the
 * account id into its own sub-pipeline, which is the same idea.
 */
export function accountMovementLookup(): Document {
  return {
    $lookup: {
      from: 'transactions',
      let: { accId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $ne: ['$status', 'ignored'] },
                {
                  $or: [
                    { $eq: ['$account_id', '$$accId'] },
                    {
                      $and: [
                        { $eq: ['$to_account_id', '$$accId'] },
                        { $eq: ['$type', 'transfer'] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            delta: {
              $sum: {
                $cond: [
                  // Money leaving this account: an expense or an outgoing
                  // transfer subtracts, income adds.
                  { $eq: ['$account_id', '$$accId'] },
                  {
                    $cond: [
                      { $eq: ['$type', 'income'] },
                      '$amount',
                      { $multiply: ['$amount', -1] },
                    ],
                  },
                  // Otherwise it is a transfer arriving here.
                  '$amount',
                ],
              },
            },
          },
        },
      ],
      as: '__movement',
    },
  };
}

const withBalance: Document = {
  $addFields: {
    balance: { $add: ['$opening_balance', { $ifNull: [{ $first: '$__movement.delta' }, 0] }] },
  },
};

/** The full list, with the owner's name joined in. */
export function accountsPipeline(userId: string): Document[] {
  return [
    { $match: { user_id: userId } },
    accountMovementLookup(),
    { $lookup: { from: 'people', localField: 'person_id', foreignField: '_id', as: '__person' } },
    { $addFields: { ...withBalance.$addFields, person_name: { $first: '$__person.name' } } },
    { $project: { __movement: 0, __person: 0 } },
    { $sort: { archived: 1, is_emergency: -1, name: 1 } },
  ];
}

/** Cash on hand, the emergency slice of it, and what is owed on cards. */
export function cashTotalsPipeline(userId: string): Document[] {
  return [
    { $match: { user_id: userId, archived: false } },
    accountMovementLookup(),
    withBalance,
    {
      $group: {
        _id: null,
        cash: { $sum: { $cond: [{ $ne: ['$type', 'credit_card'] }, '$balance', 0] } },
        emergency: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$type', 'credit_card'] }, { $eq: ['$is_emergency', true] }] },
              '$balance',
              0,
            ],
          },
        },
        // A card balance is negative when you owe; dues are the positive of it.
        cardDues: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'credit_card'] },
              { $max: [{ $multiply: ['$balance', -1] }, 0] },
              0,
            ],
          },
        },
      },
    },
  ];
}
