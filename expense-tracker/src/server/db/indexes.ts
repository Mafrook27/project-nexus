import 'server-only';
import type { IndexDescription } from 'mongodb';
import { COLLECTIONS, col, type AnyDoc, type CollectionName } from './mongo';

/**
 * Indexes replace what schema.sql used to declare.
 *
 * MongoDB will happily run without any of these, which is the trap: the app
 * would still work, just slowly, and the two UNIQUE constraints that the app
 * actually relies on for correctness would silently not exist. So this runs on
 * setup and is safe to re-run.
 */
const INDEXES: Record<CollectionName, IndexDescription[]> = {
  users: [{ key: { email: 1 }, unique: true, name: 'email_unique' }],

  people: [
    { key: { user_id: 1, name: 1 }, unique: true, name: 'user_name_unique' },
    { key: { user_id: 1 }, name: 'user' },
  ],

  accounts: [
    { key: { user_id: 1, archived: 1 }, name: 'user_archived' },
    { key: { user_id: 1, last4: 1 }, name: 'user_last4' },
  ],

  categories: [
    // The old (user_id, name, kind) UNIQUE. The CSV importer's upsert depends
    // on it, and so does seeding a fresh account.
    { key: { user_id: 1, name: 1, kind: 1 }, unique: true, name: 'user_name_kind_unique' },
  ],

  transactions: [
    { key: { user_id: 1, txn_date: -1 }, name: 'user_date' },
    { key: { user_id: 1, category_id: 1 }, name: 'user_category' },
    { key: { user_id: 1, need_level: 1 }, name: 'user_need' },
    { key: { user_id: 1, account_id: 1 }, name: 'user_account' },
    { key: { user_id: 1, to_account_id: 1 }, name: 'user_to_account' },
    // The review queue reads this constantly and it is a tiny slice of the
    // collection, so it is worth indexing only the rows that qualify.
    {
      key: { user_id: 1, status: 1 },
      name: 'user_detected',
      partialFilterExpression: { status: 'detected' },
    },
    // Supports the cross-channel duplicate window scan.
    { key: { user_id: 1, transaction_at: -1 }, name: 'user_at' },
    /**
     * THE important one. A bank reference is globally unique, so this is what
     * makes "the same SMS twice can never create two rows" a guarantee rather
     * than a hope - it holds even if two copies arrive in the same
     * millisecond, which no amount of application code can promise.
     *
     * Partial, because most rows have no reference and a plain unique index
     * would reject the second null.
     */
    {
      key: { user_id: 1, raw_reference: 1 },
      unique: true,
      name: 'user_reference_unique',
      partialFilterExpression: { raw_reference: { $type: 'string' } },
    },
  ],

  budgets: [
    { key: { user_id: 1, category_id: 1, month: 1 }, unique: true, name: 'user_cat_month_unique' },
  ],

  investments: [
    { key: { user_id: 1 }, name: 'user' },
    { key: { user_id: 1, type: 1 }, name: 'user_type' },
    { key: { user_id: 1, person_id: 1 }, name: 'user_person' },
  ],

  sips: [{ key: { user_id: 1 }, name: 'user' }],
  liabilities: [{ key: { user_id: 1 }, name: 'user' }],
  recurring: [{ key: { user_id: 1, active: 1, next_due: 1 }, name: 'user_active_due' }],
  goals: [{ key: { user_id: 1 }, name: 'user' }],

  net_worth_snapshots: [
    { key: { user_id: 1, month: 1 }, unique: true, name: 'user_month_unique' },
  ],

  devices: [{ key: { user_id: 1 }, name: 'user' }],

  merchant_rules: [
    { key: { user_id: 1, pattern: 1, match_type: 1 }, unique: true, name: 'user_pattern_unique' },
    { key: { user_id: 1 }, name: 'user' },
  ],
};

export type IndexReport = { collection: string; created: number; existing: number };

/** Creates anything missing. Existing indexes are left alone. */
export async function ensureIndexes(): Promise<IndexReport[]> {
  const report: IndexReport[] = [];
  for (const name of Object.values(COLLECTIONS)) {
    const specs = INDEXES[name] ?? [];
    if (!specs.length) continue;
    const collection = col<AnyDoc>(name);
    const before = await existingNames(collection);
    await collection.createIndexes(specs);
    const after = await existingNames(collection);
    report.push({
      collection: name,
      created: after.size - before.size,
      existing: before.size,
    });
  }
  return report;
}

async function existingNames(collection: ReturnType<typeof col<AnyDoc>>): Promise<Set<string>> {
  try {
    const list = await collection.listIndexes().toArray();
    return new Set(list.map((i) => i.name as string));
  } catch {
    // The collection does not exist yet, which is not an error.
    return new Set();
  }
}

/** Used by the self-check to confirm the guarantees are actually in place. */
export const REQUIRED_UNIQUE_INDEXES = [
  { collection: 'users', name: 'email_unique' },
  { collection: 'categories', name: 'user_name_kind_unique' },
  { collection: 'transactions', name: 'user_reference_unique' },
  { collection: 'budgets', name: 'user_cat_month_unique' },
  { collection: 'net_worth_snapshots', name: 'user_month_unique' },
  { collection: 'merchant_rules', name: 'user_pattern_unique' },
] as const;
