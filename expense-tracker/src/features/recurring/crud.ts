import type { CrudConfig } from '@/server/crud';
import { recurringSchema, recurringUpdateSchema } from './schema';

export const recurringCrud: CrudConfig = {
  collection: 'recurring',
  columns: [
    'name',
    'amount',
    'type',
    'bucket',
    'frequency',
    'next_due',
    'account_id',
    'category_id',
    'active',
  ],
  createSchema: recurringSchema,
  updateSchema: recurringUpdateSchema,
  listPipeline: (userId) => [
    { $match: { user_id: userId } },
    { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: '__c' } },
    { $lookup: { from: 'accounts', localField: 'account_id', foreignField: '_id', as: '__a' } },
    {
      $addFields: {
        category_name: { $first: '$__c.name' },
        category_color: { $first: '$__c.color' },
        account_name: { $first: '$__a.name' },
      },
    },
    { $project: { __c: 0, __a: 0 } },
    { $sort: { active: -1, next_due: 1 } },
  ],
};
