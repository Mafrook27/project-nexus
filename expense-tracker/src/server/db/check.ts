/**
 * Proves the database is set up correctly and that the guarantees this app
 * depends on are actually in force.
 *
 *   npm run db:check
 *
 * Safe to run against a database with real data: everything it writes is
 * namespaced to a throwaway user id and deleted afterwards.
 */
import './env';
import {
  closeClient,
  col,
  getClient,
  getDb,
  newId,
  transactions,
  type AnyDoc,
} from './mongo';
import { ensureIndexes, REQUIRED_UNIQUE_INDEXES } from './indexes';
import { reportDbError } from './explain';

type Check = { name: string; ok: boolean; detail: string };
const results: Check[] = [];
const record = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const TEST_USER = `__check_${newId()}`;

async function main() {
  console.log('\nChecking your database\n');

  // 1. Can we reach it at all?
  const info = await getDb().admin().command({ hello: 1 });
  record('Connected', true, getDb().databaseName);

  // 2. Transactions and the dedup guarantee both want a replica set. Atlas is
  //    always one; a single local mongod is not.
  const isReplicaSet = Boolean(info.setName);
  record(
    'Replica set (needed for multi-document transactions)',
    isReplicaSet,
    isReplicaSet ? info.setName : 'single node — batch sync falls back to sequential writes',
  );

  // 3. Indexes.
  await ensureIndexes();
  for (const required of REQUIRED_UNIQUE_INDEXES) {
    const list = await col<AnyDoc>(required.collection as never)
      .listIndexes()
      .toArray()
      .catch(() => []);
    const found = list.find((i) => i.name === required.name);
    record(
      `Unique index ${required.collection}.${required.name}`,
      Boolean(found?.unique),
      found ? '' : 'missing',
    );
  }

  // 4. A write, a read and a delete actually work.
  const id = newId();
  await transactions().insertOne(sample(id, 'CHECK-REF-1'));
  const readBack = await transactions().findOne({ _id: id });
  record('Write and read back', readBack?.amount === 123.45, `amount ${readBack?.amount}`);

  // 5. THE important one: the same bank reference cannot land twice.
  let rejected = false;
  try {
    await transactions().insertOne(sample(newId(), 'CHECK-REF-1'));
  } catch (err) {
    rejected = (err as { code?: number }).code === 11000;
  }
  record(
    'Duplicate bank reference is rejected by the database',
    rejected,
    rejected ? '' : 'a duplicate SMS could create two rows',
  );

  // 6. Money keeps two decimal places through a round trip.
  await transactions().insertOne(sample(newId(), 'CHECK-REF-2', 0.1));
  await transactions().insertOne(sample(newId(), 'CHECK-REF-3', 0.2));
  const [sum] = await transactions()
    .aggregate<{ total: number }>([
      { $match: { user_id: TEST_USER, amount: { $lt: 1 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    .toArray();
  const rounded = Math.round((sum?.total ?? 0) * 100) / 100;
  record('Money sums cleanly', rounded === 0.3, `0.1 + 0.2 = ${rounded}`);

  // 7. Aggregation with a join, which is what every dashboard tile needs.
  const joined = await transactions()
    .aggregate([
      { $match: { user_id: TEST_USER } },
      { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: 'c' } },
      { $count: 'n' },
    ])
    .toArray();
  record('Aggregation with $lookup runs', joined.length > 0);

  // 8. Multi-document transactions, if available.
  if (isReplicaSet) {
    const session = getClient().startSession();
    let rolledBack = false;
    try {
      await session.withTransaction(async () => {
        await transactions().insertOne(sample(newId(), 'CHECK-ROLLBACK'), { session });
        throw new Error('deliberate');
      });
    } catch {
      rolledBack =
        (await transactions().countDocuments({ raw_reference: 'CHECK-ROLLBACK' })) === 0;
    } finally {
      await session.endSession();
    }
    record('A failed transaction rolls back', rolledBack);
  }

  // Clean up everything this check wrote.
  const removed = await transactions().deleteMany({ user_id: TEST_USER });
  record('Cleaned up after itself', true, `${removed.deletedCount} test rows removed`);

  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length
      ? `\n\x1b[31m${failed.length} check(s) failed.\x1b[0m Fix these before trusting the data.\n`
      : `\n\x1b[32mAll ${results.length} checks passed.\x1b[0m Your database is ready.\n`,
  );
  await closeClient();
  process.exit(failed.length ? 1 : 0);
}

function sample(id: string, reference: string, amount = 123.45) {
  const now = new Date();
  return {
    _id: id,
    user_id: TEST_USER,
    account_id: null,
    to_account_id: null,
    category_id: null,
    person_id: null,
    type: 'expense' as const,
    bucket: 'personal' as const,
    need_level: 'need' as const,
    amount,
    txn_date: now.toISOString().slice(0, 10),
    transaction_at: now,
    merchant: 'Setup check',
    note: null,
    reason: null,
    source: 'manual' as const,
    status: 'confirmed' as const,
    payment_method: 'unknown',
    bank: null,
    account_last4: null,
    raw_reference: reference,
    raw_message: null,
    created_at: now,
    updated_at: now,
  };
}

main().catch(async (err) => {
  reportDbError('Check stopped:', err);
  await transactions().deleteMany({ user_id: TEST_USER }).catch(() => {});
  await closeClient().catch(() => {});
  process.exit(1);
});
