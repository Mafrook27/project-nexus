import type { CrudConfig } from '@/server/crud';
import { budgetSchema, budgetUpdateSchema } from './schema';

export const budgetsCrud: CrudConfig = {
  table: 'budgets',
  columns: ['category_id', 'month', 'amount'],
  createSchema: budgetSchema,
  updateSchema: budgetUpdateSchema,
  listSql: (userId) => ({
    text: `SELECT b.*, c.name AS category_name, c.color AS category_color, c.bucket
           FROM budgets b JOIN categories c ON c.id = b.category_id
           WHERE b.user_id = $1 ORDER BY c.bucket, c.name`,
    params: [userId],
  }),
};
