import 'server-only';
import type { ClientSession } from 'mongodb';
import {
  categories,
  getClient,
  merchantRules,
  money,
  newId,
  transactions,
  type TransactionDoc,
} from '@/server/db/mongo';
import { findAccountByLast4 } from '@/features/accounts/service';
import { DEDUPE_WINDOW_SECONDS } from '@/lib/intelligence';
import { parseBankMessage } from '../parsers';
import { pickDuplicate } from './dedupe';
import { matchRule, statusFor, type MerchantRule } from './rules';
import type { SyncEvent } from './schema';

export type SyncOutcome =
  | { status: 'created'; id: string; needsReview: boolean }
  | { status: 'duplicate'; id: string }
  | { status: 'skipped'; reason: string };

/**
 * One detected payment, from arrival to a document (or a deliberate absence).
 *
 *   parse if needed -> reject non-transactions -> find a duplicate
 *   -> apply a learned rule -> insert
 */
export async function ingestEvent(
  userId: string,
  event: SyncEvent,
  session?: ClientSession,
): Promise<SyncOutcome> {
  const resolved = resolve(event);
  if (!resolved) return { status: 'skipped', reason: 'Not a transaction message' };

  const { amount, direction, merchant, accountLast4, reference, transactionAt, confidence } =
    resolved;
  const type = direction === 'credit' ? 'income' : 'expense';

  // Layer 1: the bank's own reference. Exact, no judgement needed.
  if (reference) {
    const existing = await transactions().findOne(
      { user_id: userId, raw_reference: reference },
      { session },
    );
    if (existing) return { status: 'duplicate', id: existing._id };
  }

  // Layer 2: the same payment seen through a different channel. No shared
  // reference, so this is a judgement: same amount and type, close in time, on
  // an account and merchant that do not contradict.
  const windowMs = DEDUPE_WINDOW_SECONDS * 1000;
  const candidates = await transactions()
    .find(
      {
        user_id: userId,
        status: { $ne: 'ignored' },
        amount: money(amount),
        type,
        transaction_at: {
          $gte: new Date(transactionAt.getTime() - windowMs),
          $lte: new Date(transactionAt.getTime() + windowMs),
        },
      },
      { session, sort: { transaction_at: -1 }, limit: 20 },
    )
    .toArray();

  const duplicate = pickDuplicate(
    { amount, merchant, accountLast4, transactionAt },
    candidates.map((c) => ({
      id: c._id,
      merchant: c.merchant,
      account_last4: c.account_last4,
    })),
  );
  if (duplicate) {
    // The later message often carries detail the first one lacked.
    await transactions().updateOne(
      { _id: duplicate.id },
      [
        {
          $set: {
            merchant: { $ifNull: ['$merchant', merchant ?? null] },
            account_last4: { $ifNull: ['$account_last4', accountLast4 ?? null] },
            raw_reference: { $ifNull: ['$raw_reference', reference ?? null] },
            updated_at: new Date(),
          },
        },
      ],
      { session },
    );
    return { status: 'duplicate', id: duplicate.id };
  }

  // What have we already learned about this merchant?
  const rules = (await merchantRules()
    .find({ user_id: userId }, { session })
    .toArray()) as unknown as MerchantRule[];
  const rule = matchRule(merchant, rules.map(toRule));
  const status = statusFor(rule, confidence);

  const category = rule?.category_id
    ? await categories().findOne({ _id: rule.category_id, user_id: userId }, { session })
    : null;

  const accountId = accountLast4 ? await findAccountByLast4(userId, accountLast4) : null;
  const now = new Date();
  const id = newId();

  const doc: TransactionDoc = {
    _id: id,
    user_id: userId,
    account_id: accountId,
    to_account_id: null,
    category_id: rule?.category_id ?? null,
    person_id: null,
    type,
    bucket: (rule?.bucket ?? category?.bucket ?? 'personal') as TransactionDoc['bucket'],
    need_level: (rule?.need_level ??
      category?.default_need_level ??
      'need') as TransactionDoc['need_level'],
    amount: money(amount),
    txn_date: transactionAt.toISOString().slice(0, 10),
    transaction_at: transactionAt,
    merchant: merchant ?? null,
    note: event.description ?? null,
    reason: null,
    source: event.source,
    status,
    payment_method: resolved.paymentMethod,
    bank: resolved.bank ?? null,
    account_last4: accountLast4 ?? null,
    raw_reference: reference ?? null,
    raw_message: event.message ?? null,
    created_at: now,
    updated_at: now,
  };

  try {
    await transactions().insertOne(doc, { session });
  } catch (err) {
    // The unique index on (user_id, raw_reference) is the real guarantee: it
    // holds even when two copies of the same SMS arrive together, which no
    // amount of read-then-write application code can promise.
    if ((err as { code?: number }).code === 11000 && reference) {
      const existing = await transactions().findOne(
        { user_id: userId, raw_reference: reference },
        { session },
      );
      if (existing) return { status: 'duplicate', id: existing._id };
    }
    throw err;
  }

  if (rule) {
    await merchantRules().updateOne(
      { _id: rule.id },
      { $inc: { hits: 1 }, $set: { last_used_at: now } },
      { session },
    );
  }

  return { status: 'created', id, needsReview: status === 'detected' };
}

const toRule = (doc: MerchantRule & { _id?: string }): MerchantRule => ({
  ...doc,
  id: doc.id ?? (doc._id as string),
});

/**
 * Runs a whole batch inside one database transaction, so a phone flushing an
 * offline queue either lands entirely or not at all.
 */
export async function ingestBatch(userId: string, events: SyncEvent[]) {
  const session = getClient().startSession();
  try {
    let results: SyncOutcome[] = [];
    await session.withTransaction(async () => {
      // Reset on retry: withTransaction may run the body more than once.
      results = [];
      for (const event of events) results.push(await ingestEvent(userId, event, session));
    });
    return summarise(results);
  } catch (err) {
    // A single-node deployment cannot do transactions. Rather than fail, fall
    // back to sequential writes: the unique index still prevents duplicates.
    if (isTransactionUnsupported(err)) {
      const results: SyncOutcome[] = [];
      for (const event of events) results.push(await ingestEvent(userId, event));
      return summarise(results);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

function summarise(results: SyncOutcome[]) {
  return {
    results,
    created: results.filter((r) => r.status === 'created').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    needsReview: results.filter((r) => r.status === 'created' && r.needsReview).length,
  };
}

export function isTransactionUnsupported(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('Transaction numbers are only allowed') ||
    message.includes('requires a replica set') ||
    message.includes('not supported')
  );
}

/** Structured fields win; the raw message fills whatever they leave out. */
function resolve(event: SyncEvent) {
  const parsed = event.message ? parseBankMessage(event.message, event.sender) : null;
  const amount = event.amount ?? parsed?.amount;
  if (amount === undefined) return null;

  const direction = event.type ?? parsed?.direction ?? 'debit';
  const at = event.transactionAt ?? parsed?.transactionAt;
  return {
    amount,
    direction,
    merchant: event.merchant?.trim() || parsed?.merchant || null,
    accountLast4: event.accountLast4 ?? parsed?.accountLast4 ?? null,
    reference: event.reference ?? parsed?.reference ?? null,
    bank: event.bank ?? parsed?.bank,
    paymentMethod: event.paymentMethod ?? parsed?.paymentMethod ?? 'unknown',
    transactionAt: at ? new Date(at) : new Date(),
    // Fields the phone sent are facts, not guesses.
    confidence: event.amount !== undefined ? 0.9 : (parsed?.confidence ?? 0.4),
  };
}
