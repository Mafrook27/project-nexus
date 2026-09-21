import 'server-only';
import { accounts } from '@/server/db/mongo';
import { accountsPipeline, cashTotalsPipeline } from './pipelines';
import type { Account } from './schema';

export { accountMovementLookup, accountsPipeline, cashTotalsPipeline } from './pipelines';

export async function listAccounts(userId: string): Promise<Account[]> {
  return accounts().aggregate<Account>(accountsPipeline(userId)).toArray();
}

export type CashTotals = { cash: number; emergency: number; cardDues: number };

export async function cashTotals(userId: string): Promise<CashTotals> {
  const [row] = await accounts()
    .aggregate<CashTotals>(cashTotalsPipeline(userId))
    .toArray();
  return {
    cash: row?.cash ?? 0,
    emergency: row?.emergency ?? 0,
    cardDues: Math.max(0, row?.cardDues ?? 0),
  };
}

/** Finds the account a bank message belongs to, by its masked digits. */
export async function findAccountByLast4(
  userId: string,
  last4: string,
): Promise<string | null> {
  const match = await accounts().findOne(
    {
      user_id: userId,
      archived: false,
      $or: [{ last4 }, { name: { $regex: `${last4}$` } }],
    },
    { sort: { last4: -1 } },
  );
  return match?._id ?? null;
}
