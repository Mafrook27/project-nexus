import 'server-only';
import { transactions } from '@/server/db/mongo';
import { listTransactionsPipeline, TRANSACTION_LOOKUPS } from './pipelines';
import type { TransactionFilter } from './pipelines';
import type { Transaction } from './schema';

export { TRANSACTION_LOOKUPS, buildFilter, listTransactionsPipeline } from './pipelines';
export type { TransactionFilter } from './pipelines';

export async function listTransactions(userId: string, filter: TransactionFilter) {
  const [result] = await transactions()
    .aggregate<{
      rows: Transaction[];
      totals: { count: number; income: number; expense: number }[];
    }>(listTransactionsPipeline(userId, filter))
    .toArray();

  const totals = result?.totals?.[0];
  return {
    rows: result?.rows ?? [],
    count: totals?.count ?? 0,
    income: totals?.income ?? 0,
    expense: totals?.expense ?? 0,
  };
}

export async function getTransaction(userId: string, id: string): Promise<Transaction | null> {
  const [row] = await transactions()
    .aggregate<Transaction>([{ $match: { _id: id, user_id: userId } }, ...TRANSACTION_LOOKUPS])
    .toArray();
  return row ?? null;
}
