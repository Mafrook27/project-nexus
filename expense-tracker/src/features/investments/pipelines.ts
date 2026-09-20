import type { Document } from 'mongodb';

/** Totals, split by asset type and by whose money it is, in one pass. */
export function portfolioPipeline(userId: string): Document[] {
  return [
      { $match: { user_id: userId } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                invested: { $sum: '$invested' },
                current: { $sum: '$current_value' },
                liquid: {
                  $sum: { $cond: [{ $eq: ['$liquid', true] }, '$current_value', 0] },
                },
              },
            },
          ],
          byType: [
            {
              $group: {
                _id: '$type',
                invested: { $sum: '$invested' },
                current: { $sum: '$current_value' },
              },
            },
            { $project: { _id: 0, type: '$_id', invested: 1, current: 1 } },
            { $sort: { current: -1 } },
          ],
          byPerson: [
            {
              $group: {
                _id: '$person_id',
                invested: { $sum: '$invested' },
                current: { $sum: '$current_value' },
              },
            },
            { $lookup: { from: 'people', localField: '_id', foreignField: '_id', as: '__p' } },
            {
              $project: {
                _id: 0,
                person_id: '$_id',
                name: { $ifNull: [{ $first: '$__p.name' }, 'Unassigned'] },
                color: { $ifNull: [{ $first: '$__p.color' }, '#94A3B8'] },
                invested: 1,
                current: 1,
              },
            },
            { $sort: { current: -1 } },
          ],
        },
      },
  ];
}
