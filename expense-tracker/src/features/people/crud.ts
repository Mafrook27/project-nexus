import type { CrudConfig } from '@/server/crud';
import { personSchema, personUpdateSchema } from './schema';

export const peopleCrud: CrudConfig = {
  collection: 'people',
  columns: ['name', 'relation', 'color'],
  createSchema: personSchema,
  updateSchema: personUpdateSchema,
  // "Me" first, then everyone else alphabetically.
  listPipeline: (userId) => [
    { $match: { user_id: userId } },
    { $addFields: { __self: { $cond: [{ $eq: ['$relation', 'self'] }, 0, 1] } } },
    { $sort: { __self: 1, name: 1 } },
    { $project: { __self: 0 } },
  ],
};
