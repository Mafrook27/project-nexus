import type { CrudConfig } from '@/server/crud';
import { categorySchema, categoryUpdateSchema } from './schema';

export const categoriesCrud: CrudConfig = {
  table: 'categories',
  columns: ['name', 'kind', 'bucket', 'icon', 'color'],
  createSchema: categorySchema,
  updateSchema: categoryUpdateSchema,
  orderBy: 'kind, bucket, name',
};
