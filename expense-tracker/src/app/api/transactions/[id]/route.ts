import { itemRoutes } from '@/server/crud';
import { transactionSchema, transactionUpdateSchema } from '@/features/transactions/schema';

export const runtime = 'nodejs';

export const { GET, PATCH, DELETE } = itemRoutes({
  table: 'transactions',
  columns: [
    'type',
    'bucket',
    'need_level',
    'amount',
    'txn_date',
    'account_id',
    'to_account_id',
    'category_id',
    'person_id',
    'merchant',
    'note',
  ],
  createSchema: transactionSchema,
  updateSchema: transactionUpdateSchema,
});
