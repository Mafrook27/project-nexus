import type { CrudConfig } from '@/server/crud';
import { liabilitySchema, liabilityUpdateSchema } from './schema';

export const liabilitiesCrud: CrudConfig = {
  collection: 'liabilities',
  columns: [
    'name',
    'type',
    'person_id',
    'principal',
    'outstanding',
    'interest_rate',
    'emi',
    'end_date',
  ],
  createSchema: liabilitySchema,
  updateSchema: liabilityUpdateSchema,
  listPipeline: (userId) => [
    { $match: { user_id: userId } },
    { $lookup: { from: 'people', localField: 'person_id', foreignField: '_id', as: '__p' } },
    { $addFields: { person_name: { $first: '$__p.name' } } },
    { $project: { __p: 0 } },
    { $sort: { outstanding: -1 } },
  ],
};
