import type { CrudConfig } from '@/server/crud';
import { goalSchema, goalUpdateSchema } from './schema';

export const goalsCrud: CrudConfig = {
  table: 'goals',
  columns: ['name', 'kind', 'target_amount', 'saved_amount', 'monthly_contribution', 'target_date'],
  createSchema: goalSchema,
  updateSchema: goalUpdateSchema,
  orderBy: 'target_date NULLS LAST, name',
};
