import type { CrudConfig } from '@/server/crud';
import { liabilitySchema, liabilityUpdateSchema } from './schema';

export const liabilitiesCrud: CrudConfig = {
  table: 'liabilities',
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
  listSql: (userId) => ({
    text: `SELECT l.*, p.name AS person_name FROM liabilities l
           LEFT JOIN people p ON p.id = l.person_id
           WHERE l.user_id = $1 ORDER BY l.outstanding DESC`,
    params: [userId],
  }),
};
