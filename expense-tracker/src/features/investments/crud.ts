import type { CrudConfig } from '@/server/crud';
import { investmentSchema, investmentUpdateSchema } from './schema';

export const investmentsCrud: CrudConfig = {
  collection: 'investments',
  columns: [
    'name',
    'type',
    'person_id',
    'symbol',
    'units',
    'avg_price',
    'last_price',
    'invested',
    'current_value',
    'start_date',
    'maturity_date',
    'liquid',
    'notes',
  ],
  createSchema: investmentSchema,
  updateSchema: investmentUpdateSchema,
  listPipeline: (userId) => [
    { $match: { user_id: userId } },
    { $lookup: { from: 'people', localField: 'person_id', foreignField: '_id', as: '__p' } },
    {
      $addFields: {
        person_name: { $first: '$__p.name' },
        person_color: { $first: '$__p.color' },
      },
    },
    { $project: { __p: 0 } },
    { $sort: { current_value: -1, name: 1 } },
  ],
};
