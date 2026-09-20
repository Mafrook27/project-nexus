import type { CrudConfig } from '@/server/crud';
import { personSchema, personUpdateSchema } from './schema';

export const peopleCrud: CrudConfig = {
  table: 'people',
  columns: ['name', 'relation', 'color'],
  createSchema: personSchema,
  updateSchema: personUpdateSchema,
  orderBy: `CASE relation WHEN 'self' THEN 0 ELSE 1 END, name`,
};
