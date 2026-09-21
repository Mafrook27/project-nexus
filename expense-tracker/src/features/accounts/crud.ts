import type { CrudConfig } from '@/server/crud';
import { accountsPipeline } from './service';
import { accountSchema, accountUpdateSchema } from './schema';

export const accountsCrud: CrudConfig = {
  collection: 'accounts',
  columns: [
    'name',
    'type',
    'person_id',
    'institution',
    'opening_balance',
    'last4',
    'is_emergency',
    'archived',
  ],
  createSchema: accountSchema,
  updateSchema: accountUpdateSchema,
  listPipeline: accountsPipeline,
};
