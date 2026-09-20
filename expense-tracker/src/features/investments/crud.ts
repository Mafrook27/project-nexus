import type { CrudConfig } from '@/server/crud';
import { investmentSchema, investmentUpdateSchema } from './schema';

export const investmentsCrud: CrudConfig = {
  table: 'investments',
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
  listSql: (userId) => ({
    text: `SELECT i.*, p.name AS person_name, p.color AS person_color
           FROM investments i
           LEFT JOIN people p ON p.id = i.person_id
           WHERE i.user_id = $1
           ORDER BY i.current_value DESC, i.name ASC`,
    params: [userId],
  }),
};
