import type { CrudConfig } from '@/server/crud';
import { categorySchema, categoryUpdateSchema } from './schema';

export const categoriesCrud: CrudConfig = {
  table: 'categories',
  columns: ['name', 'kind', 'bucket', 'default_need_level', 'icon', 'color'],
  createSchema: categorySchema,
  updateSchema: categoryUpdateSchema,
  orderBy: 'kind, bucket, name',
};
