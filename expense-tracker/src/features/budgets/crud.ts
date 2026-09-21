import type { CrudConfig } from '@/server/crud';
import { budgetSchema, budgetUpdateSchema } from './schema';

export const budgetsCrud: CrudConfig = {
  collection: 'budgets',
  columns: ['category_id', 'month', 'amount'],
  createSchema: budgetSchema,
  updateSchema: budgetUpdateSchema,
  listPipeline: (userId) => [
    { $match: { user_id: userId } },
    { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: '__c' } },
    {
      $addFields: {
        category_name: { $first: '$__c.name' },
        category_color: { $first: '$__c.color' },
        bucket: { $first: '$__c.bucket' },
      },
    },
    { $project: { __c: 0 } },
    { $sort: { bucket: 1, category_name: 1 } },
  ],
};
