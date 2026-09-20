import 'server-only';
import { transaction, type query as QueryFn } from '@/server/db/client';
import { parseBankMessage } from '../parsers';
import { DUPLICATE_WINDOW_SQL, pickDuplicate } from './dedupe';
import { matchRule, statusFor, type MerchantRule } from './rules';
import type { SyncEvent } from './schema';

export type SyncOutcome =
  | { status: 'created'; id: string; needsReview: boolean }
  | { status: 'duplicate'; id: string }
  | { status: 'skipped'; reason: string };

/**
 * One detected payment, from arrival to a row (or a deliberate non-row).
 *
 *   parse if needed -> reject non-transactions -> find a duplicate
 *   -> apply a learned rule -> insert
 *
 * Runs inside a transaction per batch so a duplicate check cannot race with
 * the insert that would have made it true.
 */
export async function ingestEvent(
  q: typeof QueryFn,
  userId: string,
  event: SyncEvent,
): Promise<SyncOutcome> {
  const resolved = resolve(event);
  if (!resolved) return { status: 'skipped', reason: 'Not a transaction message' };

  const { amount, direction, merchant, accountLast4, reference, transactionAt, confidence } =
    resolved;
  const type = direction === 'credit' ? 'income' : 'expense';

  // Layer 1: the bank's own reference. Exact, no judgement needed.
  if (reference) {
    const [existing] = await q<{ id: string }>(
      `SELECT id FROM transactions WHERE user_id = $1 AND raw_reference = $2`,
      [userId, reference],
    );
    if (existing) return { status: 'duplicate', id: existing.id };
  }

  // Layer 2: the same payment seen through a different channel.
  const candidates = await q<{ id: string; merchant: string | null; account_last4: string | null }>(
    DUPLICATE_WINDOW_SQL,
    [userId, amount, type, transactionAt.toISOString()],
  );
  const duplicate = pickDuplicate(
    { amount, merchant, accountLast4, transactionAt },
    candidates,
  );
  if (duplicate) {
    // The later message often carries detail the first one lacked.
    await q(
      `UPDATE transactions
         SET merchant      = COALESCE(merchant, $2),
             account_last4 = COALESCE(account_last4, $3),
             raw_reference = COALESCE(raw_reference, $4),
             updated_at    = now()
       WHERE id = $1`,
      [duplicate.id, merchant ?? null, accountLast4 ?? null, reference ?? null],
    );
    return { status: 'duplicate', id: duplicate.id };
  }

  // What have we already learned about this merchant?
  const rules = await q<MerchantRule>(
    `SELECT id, pattern, match_type, category_id, bucket, need_level, auto_confirm
     FROM merchant_rules WHERE user_id = $1`,
    [userId],
  );
  const rule = matchRule(merchant, rules);
  const status = statusFor(rule, confidence);

  // Fall back to the category's own defaults for anything the rule leaves out.
  const category = rule?.category_id
    ? (
        await q<{ bucket: string; default_need_level: string }>(
          `SELECT bucket, default_need_level FROM categories WHERE id = $1 AND user_id = $2`,
          [rule.category_id, userId],
        )
      )[0]
    : undefined;

  const accountId = accountLast4 ? await findAccount(q, userId, accountLast4) : null;

  const [row] = await q<{ id: string }>(
    `INSERT INTO transactions
       (user_id, account_id, category_id, type, bucket, need_level, amount,
        txn_date, transaction_at, merchant, note, source, status, payment_method,
        bank, account_last4, raw_reference, raw_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    [
      userId,
      accountId,
      rule?.category_id ?? null,
      type,
      rule?.bucket ?? category?.bucket ?? 'personal',
      rule?.need_level ?? category?.default_need_level ?? 'need',
      amount,
      transactionAt.toISOString(),
      merchant ?? null,
      event.description ?? null,
      event.source,
      status,
      resolved.paymentMethod,
      resolved.bank ?? null,
      accountLast4 ?? null,
      reference ?? null,
      event.message ?? null,
    ],
  );

  if (rule) {
    await q(`UPDATE merchant_rules SET hits = hits + 1, last_used_at = now() WHERE id = $1`, [
      rule.id,
    ]);
  }

  return { status: 'created', id: row.id, needsReview: status === 'detected' };
}

/** Runs a whole batch in one database transaction. */
export async function ingestBatch(userId: string, events: SyncEvent[]) {
  return transaction(async (q) => {
    const results: SyncOutcome[] = [];
    for (const event of events) results.push(await ingestEvent(q, userId, event));
    return {
      results,
      created: results.filter((r) => r.status === 'created').length,
      duplicates: results.filter((r) => r.status === 'duplicate').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      needsReview: results.filter((r) => r.status === 'created' && r.needsReview).length,
    };
  });
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
    // A phone's clock beats no clock; a bank's own stamp beats both.
    transactionAt: at ? new Date(at) : new Date(),
    // Fields the phone sent are facts, not guesses.
    confidence: event.amount !== undefined ? 0.9 : (parsed?.confidence ?? 0.4),
  };
}

async function findAccount(q: typeof QueryFn, userId: string, last4: string) {
  const [account] = await q<{ id: string }>(
    `SELECT id FROM accounts
     WHERE user_id = $1 AND archived = false AND (last4 = $2 OR name ILIKE '%' || $2)
     ORDER BY (last4 = $2) DESC LIMIT 1`,
    [userId, last4],
  );
  return account?.id ?? null;
}
