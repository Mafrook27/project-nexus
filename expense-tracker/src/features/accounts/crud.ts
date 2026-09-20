import type { CrudConfig } from '@/server/crud';
import { ACCOUNT_BALANCE_SQL } from './service';
import { accountSchema, accountUpdateSchema } from './schema';

export const accountsCrud: CrudConfig = {
  table: 'accounts',
  columns: [
    'name',
    'type',
    'person_id',
    'institution',
    'opening_balance',
    'is_emergency',
    'archived',
  ],
  createSchema: accountSchema,
  updateSchema: accountUpdateSchema,
  listSql: (userId) => ({
    text: `SELECT a.*, p.name AS person_name, ${ACCOUNT_BALANCE_SQL} AS balance
           FROM accounts a
           LEFT JOIN people p ON p.id = a.person_id
           WHERE a.user_id = $1
           ORDER BY a.archived ASC, a.is_emergency DESC, a.name ASC`,
    params: [userId],
  }),
};
