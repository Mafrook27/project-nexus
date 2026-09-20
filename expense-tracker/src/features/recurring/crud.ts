import type { CrudConfig } from '@/server/crud';
import { recurringSchema, recurringUpdateSchema } from './schema';

export const recurringCrud: CrudConfig = {
  table: 'recurring',
  columns: [
    'name',
    'amount',
    'type',
    'bucket',
    'frequency',
    'next_due',
    'account_id',
    'category_id',
    'active',
  ],
  createSchema: recurringSchema,
  updateSchema: recurringUpdateSchema,
  listSql: (userId) => ({
    text: `SELECT r.*, c.name AS category_name, c.color AS category_color, a.name AS account_name
           FROM recurring r
           LEFT JOIN categories c ON c.id = r.category_id
           LEFT JOIN accounts a ON a.id = r.account_id
           WHERE r.user_id = $1
           ORDER BY r.active DESC, r.next_due ASC`,
    params: [userId],
  }),
};
