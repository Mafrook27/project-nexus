import type { CrudConfig } from '@/server/crud';
import { merchantRuleSchema, merchantRuleUpdateSchema } from './schema';

export const merchantRulesCrud: CrudConfig = {
  collection: 'merchant_rules',
  columns: ['pattern', 'match_type', 'category_id', 'bucket', 'need_level', 'auto_confirm'],
  createSchema: merchantRuleSchema,
  updateSchema: merchantRuleUpdateSchema,
  defaults: { hits: 0, last_used_at: null },
  listPipeline: (userId) => [
    { $match: { user_id: userId } },
    { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: '__c' } },
    {
      $addFields: {
        category_name: { $first: '$__c.name' },
        category_color: { $first: '$__c.color' },
      },
    },
    { $project: { __c: 0 } },
    { $sort: { hits: -1, pattern: 1 } },
  ],
};
