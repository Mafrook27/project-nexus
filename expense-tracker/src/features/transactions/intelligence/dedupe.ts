/**
 * Deduplication, in two layers, because the two kinds of duplicate are
 * genuinely different problems.
 *
 * 1. THE SAME MESSAGE TWICE. Android re-delivers an SMS, or the phone flushes
 *    a queue it already sent. The bank's own reference (UPI RRN, NEFT UTR,
 *    card auth code) is unique, so a unique index on it settles this with no
 *    guessing at all.
 *
 * 2. THE SAME PAYMENT REPORTED BY DIFFERENT CHANNELS. One ₹500 payment can
 *    produce a Google Pay notification, a bank SMS and a bank-app push. None
 *    of them share a reference. Here we have to judge: same amount, same
 *    account, close enough in time, and a merchant that does not contradict.
 *
 * Getting this wrong in the safe direction (rejecting a real second purchase)
 * is annoying; getting it wrong the other way puts phantom money in someone's
 * dashboard. The window is deliberately short and the merchant check
 * deliberately strict.
 */

/** Lowercased letters and digits only, so "Swiggy Ltd." and "SWIGGY" match. */
export function normaliseMerchant(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Do two merchant names refer to the same payee? An absent name agrees with
 * anything, since a notification often has one where the SMS does not.
 */
export function merchantsAgree(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normaliseMerchant(a);
  const right = normaliseMerchant(b);
  if (!left || !right) return true;
  if (left === right) return true;
  // "swiggy" vs "swiggyindia" is the same shop written two ways.
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 4 && longer.startsWith(shorter);
}

export function accountsAgree(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true;
  return a === b;
}

export type DuplicateCandidate = {
  id: string;
  merchant: string | null;
  account_last4: string | null;
};

export type IncomingForDedupe = {
  amount: number;
  merchant?: string | null;
  accountLast4?: string | null;
  transactionAt: Date;
};

/**
 * Given the rows already inside the time window, decide whether the incoming
 * event is one of them. Pure, so the rules are unit-testable without a
 * database.
 */
export function pickDuplicate(
  incoming: IncomingForDedupe,
  candidates: DuplicateCandidate[],
): DuplicateCandidate | null {
  return (
    candidates.find(
      (c) =>
        accountsAgree(incoming.accountLast4, c.account_last4) &&
        merchantsAgree(incoming.merchant, c.merchant),
    ) ?? null
  );
}
