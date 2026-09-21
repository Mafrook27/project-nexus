import type { CrudConfig } from '@/server/crud';
import { goalSchema, goalUpdateSchema } from './schema';

export const goalsCrud: CrudConfig = {
  collection: 'goals',
  columns: ['name', 'kind', 'target_amount', 'saved_amount', 'monthly_contribution', 'target_date'],
  createSchema: goalSchema,
  updateSchema: goalUpdateSchema,
  // Mongo sorts null before a string ascending, so dated goals come first by
  // sorting descending on a flag rather than on the date itself.
  listPipeline: (userId) => [
    { $match: { user_id: userId } },
    { $addFields: { __dated: { $cond: [{ $eq: ['$target_date', null] }, 1, 0] } } },
    { $sort: { __dated: 1, target_date: 1, name: 1 } },
    { $project: { __dated: 0 } },
  ],
};
