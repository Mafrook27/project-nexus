import type { CrudConfig } from '@/server/crud';
import { categorySchema, categoryUpdateSchema } from './schema';

export const categoriesCrud: CrudConfig = {
  collection: 'categories',
  columns: ['name', 'kind', 'bucket', 'default_need_level', 'icon', 'color'],
  createSchema: categorySchema,
  updateSchema: categoryUpdateSchema,
  sort: { kind: 1, bucket: 1, name: 1 },
};
