import type { PaymentMethod } from './types';

/** Shared extraction used by every bank parser. */

/** "Rs.1,250.50" / "INR 1250" / "₹1,250" -> 1250.5 */
export function extractAmount(message: string): number | null {
  const match = message.match(
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i,
  );
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** "A/c XX1234", "Card no. *1234", "AC X1234" -> "1234" */
export function extractAccountLast4(message: string): string | undefined {
  const match = message.match(
    /(?:a\/c|a\/c no|ac|acct|account|card)\s*(?:no\.?|number)?\s*[:.\-]?\s*[xX*•]+\s*(\d{3,4})/i,
  );
  return match?.[1];
}

/** UPI RRN, NEFT UTR, card auth code - whatever the bank calls its reference. */
export function extractReference(message: string): string | undefined {
  const labelled = message.match(
    /(?:ref(?:erence)?(?:\s*(?:no|num|id)\.?)?|rrn|utr|txn\s*(?:id|no)|transaction\s*id)\s*[:.\-]?\s*([A-Za-z0-9]{6,25})/i,
  );
  if (labelled?.[1]) return labelled[1];
  // Axis and ICICI embed it: UPI/P2M/528312345678/SWIGGY
  const embedded = message.match(/UPI[\/:]\s*(?:P2[MA][\/:])?\s*(\d{9,20})/i);
  return embedded?.[1];
}

export function detectPaymentMethod(message: string): PaymentMethod {
  const m = message.toLowerCase();
  if (/\batm\b|cash\s*(?:withdraw|wdl)|withdrawn at/.test(m)) return 'atm';
  if (/\bupi\b|vpa|@[a-z]{2,}|p2m|p2a/.test(m)) return 'upi';
  if (/\bcard\b|spent on|swiped|pos\b/.test(m)) return 'card';
  // Checked after UPI on purpose: a UPI alert often says "transfer" too.
  if (/neft|imps|rtgs|\btransfer(?:red)?\b/.test(m)) return 'bank_transfer';
  return 'unknown';
}

/** Debit wins: "debited ... and credited to SWIGGY" is money leaving you. */
export function detectDirection(message: string): 'debit' | 'credit' | null {
  const m = message.toLowerCase();
  if (/debited|spent|withdrawn|sent|paid|purchase|deducted|txn of/.test(m)) return 'debit';
  if (/credited|received|deposited|refund/.test(m)) return 'credit';
  return null;
}

/**
 * Messages that look like transactions but are not: one-time passwords,
 * balance alerts, declines, and warnings about what *will* happen.
 */
export function isNotATransaction(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /\botp\b|one[\s-]?time\s*password|do not share/.test(m) ||
    /will be (?:debited|charged|deducted)|is due|due on|reminder/.test(m) ||
    /declined|failed|unsuccessful|reversed/.test(m) ||
    /(?:avl|available|total)\s*(?:bal|balance)[^.]*$/i.test(m.split(/[.;]/)[0] ?? '') ||
    /^(?:your|the)\s+(?:a\/c|account)[^.]*balance\s+is\b/.test(m)
  );
}

const VPA_SUFFIX = /@[a-z0-9.\-]+$/i;
const NOISE = /^(?:vpa|to|at|from|mr|ms|the)\s+/i;

/** "VPA swiggy@ybl" -> "Swiggy". "AMAZON RETAIL IN" -> "Amazon Retail In". */
export function cleanMerchant(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let name = raw.trim().replace(NOISE, '').replace(VPA_SUFFIX, '');
  name = name
    .replace(/\b(?:pvt|ltd|limited|india|in|private)\b\.?/gi, ' ')
    .replace(/[_*]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[.,;:\-\s]+$/, '')
    .trim();
  if (name.length < 2 || name.length > 60) return undefined;
  if (/^\d+$/.test(name)) return undefined;
  // Banks shout ("AMAZON") and VPA handles whisper ("swiggy@ybl"). Either way
  // the name carries no capitalisation of its own, so give it sentence case.
  // A name that already mixes cases ("BigBasket") is left exactly as written.
  if (name === name.toUpperCase() || name === name.toLowerCase()) {
    name = name
      .toLowerCase()
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  return name;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Reads the date banks put in the body. Returns an ISO instant, or undefined
 * when the message has no date - in which case the receiving device's clock is
 * the better answer anyway.
 */
export function extractTimestamp(message: string, now = new Date()): string | undefined {
  // 20-09-26 13:10:00 / 20/09/2026 13:10
  const dmy = message.match(
    /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:[\s,:]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return build(year, Number(dmy[2]), Number(dmy[1]), dmy[4], dmy[5], dmy[6], now);
  }
  // 20-Sep-26 / 20 Sep 2026
  const named = message.match(
    /(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})(?:[\s,:]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (named) {
    const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    if (month > 0) {
      const year = named[3].length === 2 ? 2000 + Number(named[3]) : Number(named[3]);
      return build(year, month, Number(named[1]), named[4], named[5], named[6], now);
    }
  }
  return undefined;
}

function build(
  year: number,
  month: number,
  day: number,
  hh: string | undefined,
  mm: string | undefined,
  ss: string | undefined,
  now: Date,
): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(
    year,
    month - 1,
    day,
    hh ? Number(hh) : 12,
    mm ? Number(mm) : 0,
    ss ? Number(ss) : 0,
  );
  if (Number.isNaN(date.getTime())) return undefined;
  // A date far in the future means we misread it; trust the clock instead.
  if (date.getTime() > now.getTime() + 36 * 3600_000) return undefined;
  return date.toISOString();
}
