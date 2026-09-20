import type { CrudConfig } from '@/server/crud';
import { merchantRuleSchema, merchantRuleUpdateSchema } from './schema';

export const merchantRulesCrud: CrudConfig = {
  table: 'merchant_rules',
  columns: ['pattern', 'match_type', 'category_id', 'bucket', 'need_level', 'auto_confirm'],
  createSchema: merchantRuleSchema,
  updateSchema: merchantRuleUpdateSchema,
  listSql: (userId) => ({
    text: `SELECT r.*, c.name AS category_name, c.color AS category_color
           FROM merchant_rules r
           LEFT JOIN categories c ON c.id = r.category_id
           WHERE r.user_id = $1
           ORDER BY r.hits DESC, r.pattern ASC`,
    params: [userId],
  }),
};
