import 'server-only';
import { MongoClient, type Collection, type Db, type Document } from 'mongodb';

/**
 * MongoDB connection and the shape of every collection.
 *
 * Two decisions worth knowing, both made to keep the port from turning into a
 * rewrite of the whole app:
 *
 * 1. `_id` is a UUID string, not an ObjectId. Every zod schema validates ids
 *    with `z.uuid()`, every route takes one as a path parameter and the React
 *    layer passes them around as strings. ObjectIds would have bought nothing
 *    and touched forty files.
 *
 * 2. Field names stay snake_case. The entire UI reads `need_level`,
 *    `category_id`, `txn_date`. Renaming them to camelCase would have been a
 *    pointless rewrite of code that already works.
 */

declare global {
  // eslint-disable-next-line no-var
  var __paisaMongo: MongoClient | undefined;
}

let cached: MongoClient | undefined = globalThis.__paisaMongo;

function createClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Run `npm run setup`, or fill in .env.local.');
  }
  return new MongoClient(uri, {
    // A free Atlas cluster allows 500 connections; this app needs a handful.
    maxPoolSize: Number(process.env.MONGO_POOL_MAX ?? 10),
    serverSelectionTimeoutMS: 15_000,
    retryWrites: true,
  });
}

/**
 * Created on first use rather than at import time, so a build on a machine
 * with no database never fails just by loading a route file.
 */
export function getClient(): MongoClient {
  if (!cached) {
    cached = createClient();
    if (process.env.NODE_ENV !== 'production') globalThis.__paisaMongo = cached;
  }
  return cached;
}

/** The database name comes from the URI path, defaulting to `paisa`. */
export function getDb(): Db {
  const uri = process.env.MONGODB_URI ?? '';
  const fromUri = uri.split('/').pop()?.split('?')[0];
  return getClient().db(fromUri || 'paisa');
}

export async function closeClient(): Promise<void> {
  await cached?.close();
  cached = undefined;
  globalThis.__paisaMongo = undefined;
}

// ---------------------------------------------------------------------------
// Document shapes. These mirror what the old tables held, so the API and the
// UI did not have to change.
// ---------------------------------------------------------------------------

export type WithId = { _id: string };

/**
 * The driver types `_id` as an ObjectId unless told otherwise. Every document
 * here uses a UUID string, so generic helpers are typed against this.
 */
export type AnyDoc = { _id: string; [key: string]: unknown };
export type Owned = WithId & { user_id: string };

export type UserDoc = WithId & {
  email: string;
  name: string;
  password_hash: string;
  currency: string;
  settings: Record<string, number>;
  created_at: Date;
};

export type PersonDoc = Owned & {
  name: string;
  relation: string;
  color: string;
  created_at: Date;
};

export type AccountDoc = Owned & {
  person_id: string | null;
  name: string;
  type: string;
  institution: string | null;
  opening_balance: number;
  last4: string | null;
  is_emergency: boolean;
  archived: boolean;
  created_at: Date;
};

export type CategoryDoc = Owned & {
  name: string;
  kind: 'expense' | 'income';
  bucket: 'home' | 'personal';
  default_need_level: 'need' | 'want' | 'waste';
  icon: string;
  color: string;
  created_at: Date;
};

export type TransactionDoc = Owned & {
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  person_id: string | null;
  type: 'expense' | 'income' | 'transfer';
  bucket: 'home' | 'personal';
  need_level: 'need' | 'want' | 'waste';
  amount: number;
  /** 'YYYY-MM-DD'. A string so month ranges and $substr grouping stay simple. */
  txn_date: string;
  /** The precise instant. Deduplication needs the seconds. */
  transaction_at: Date | null;
  merchant: string | null;
  note: string | null;
  reason: string | null;
  source: 'manual' | 'sms' | 'notification' | 'import';
  status: 'detected' | 'confirmed' | 'categorized' | 'ignored';
  payment_method: string;
  bank: string | null;
  account_last4: string | null;
  raw_reference: string | null;
  raw_message: string | null;
  created_at: Date;
  updated_at: Date;
};

export type BudgetDoc = Owned & {
  category_id: string;
  month: string;
  amount: number;
};

export type InvestmentDoc = Owned & {
  person_id: string | null;
  name: string;
  type: string;
  symbol: string | null;
  units: number | null;
  avg_price: number | null;
  last_price: number | null;
  invested: number;
  current_value: number;
  start_date: string | null;
  maturity_date: string | null;
  liquid: boolean;
  notes: string | null;
  updated_at: Date;
  created_at: Date;
};

export type SipDoc = Owned & {
  person_id: string | null;
  investment_id: string | null;
  name: string;
  amount: number;
  day_of_month: number;
  expected_return: number;
  step_up_pct: number;
  start_date: string;
  active: boolean;
  created_at: Date;
};

export type LiabilityDoc = Owned & {
  person_id: string | null;
  name: string;
  type: string;
  principal: number;
  outstanding: number;
  interest_rate: number;
  emi: number;
  end_date: string | null;
  created_at: Date;
};

export type RecurringDoc = Owned & {
  account_id: string | null;
  category_id: string | null;
  name: string;
  amount: number;
  type: 'expense' | 'income';
  bucket: 'home' | 'personal';
  frequency: string;
  next_due: string;
  active: boolean;
  created_at: Date;
};

export type GoalDoc = Owned & {
  name: string;
  kind: string;
  target_amount: number;
  saved_amount: number;
  monthly_contribution: number;
  target_date: string | null;
  created_at: Date;
};

export type SnapshotDoc = Owned & {
  month: string;
  cash: number;
  investments: number;
  liabilities: number;
  net_worth: number;
  created_at: Date;
};

export type DeviceDoc = Owned & {
  name: string;
  platform: string;
  token_hash: string;
  last_seen_at: Date | null;
  synced_count: number;
  revoked_at: Date | null;
  created_at: Date;
};

export type MerchantRuleDoc = Owned & {
  pattern: string;
  match_type: 'contains' | 'exact';
  category_id: string | null;
  bucket: string | null;
  need_level: string | null;
  auto_confirm: boolean;
  hits: number;
  last_used_at: Date | null;
  created_at: Date;
};

/** Every collection this app uses, in one place. */
export const COLLECTIONS = {
  users: 'users',
  people: 'people',
  accounts: 'accounts',
  categories: 'categories',
  transactions: 'transactions',
  budgets: 'budgets',
  investments: 'investments',
  sips: 'sips',
  liabilities: 'liabilities',
  recurring: 'recurring',
  goals: 'goals',
  netWorthSnapshots: 'net_worth_snapshots',
  devices: 'devices',
  merchantRules: 'merchant_rules',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const col = <T extends Document = Document>(name: CollectionName): Collection<T> =>
  getDb().collection<T>(name);

export const users = () => col<UserDoc>('users');
export const people = () => col<PersonDoc>('people');
export const accounts = () => col<AccountDoc>('accounts');
export const categories = () => col<CategoryDoc>('categories');
export const transactions = () => col<TransactionDoc>('transactions');
export const budgets = () => col<BudgetDoc>('budgets');
export const investments = () => col<InvestmentDoc>('investments');
export const sips = () => col<SipDoc>('sips');
export const liabilities = () => col<LiabilityDoc>('liabilities');
export const recurring = () => col<RecurringDoc>('recurring');
export const goals = () => col<GoalDoc>('goals');
export const snapshots = () => col<SnapshotDoc>('net_worth_snapshots');
export const devices = () => col<DeviceDoc>('devices');
export const merchantRules = () => col<MerchantRuleDoc>('merchant_rules');

/**
 * Postgres stored money as numeric(16,2) - exact decimal. MongoDB stores a
 * double, so rounding to paise on every write keeps sums from drifting into
 * 0.30000000000000004 territory.
 */
export const money = (value: number): number => Math.round(value * 100) / 100;

/** Documents carry their own id, so every insert goes through this. */
export const newId = (): string => crypto.randomUUID();
