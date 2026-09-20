import type { CrudConfig } from '@/server/crud';
import { sipSchema, sipUpdateSchema } from './schema';

export const sipsCrud: CrudConfig = {
  table: 'sips',
  columns: [
    'name',
    'amount',
    'person_id',
    'investment_id',
    'day_of_month',
    'expected_return',
    'step_up_pct',
    'start_date',
    'active',
  ],
  createSchema: sipSchema,
  updateSchema: sipUpdateSchema,
  listSql: (userId) => ({
    text: `SELECT s.*, p.name AS person_name, i.name AS investment_name
           FROM sips s
           LEFT JOIN people p ON p.id = s.person_id
           LEFT JOIN investments i ON i.id = s.investment_id
           WHERE s.user_id = $1
           ORDER BY s.active DESC, s.amount DESC`,
    params: [userId],
  }),
};
