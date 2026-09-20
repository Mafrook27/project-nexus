import type { CrudConfig } from '@/server/crud';
import { sipSchema, sipUpdateSchema } from './schema';

export const sipsCrud: CrudConfig = {
  collection: 'sips',
  columns: [
    'name',
    'amount',
    'person_id',
    'investment_id',
    'day_of_month',
    'expected_return',
    'step_up_pct',
    'start_date',
    'active',
  ],
  createSchema: sipSchema,
  updateSchema: sipUpdateSchema,
  listPipeline: (userId) => [
    { $match: { user_id: userId } },
    { $lookup: { from: 'people', localField: 'person_id', foreignField: '_id', as: '__p' } },
    { $lookup: { from: 'investments', localField: 'investment_id', foreignField: '_id', as: '__i' } },
    {
      $addFields: {
        person_name: { $first: '$__p.name' },
        investment_name: { $first: '$__i.name' },
      },
    },
    { $project: { __p: 0, __i: 0 } },
    { $sort: { active: -1, amount: -1 } },
  ],
};
