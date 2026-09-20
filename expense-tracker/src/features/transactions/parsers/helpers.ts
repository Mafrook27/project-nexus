import type { PaymentMethod } from './types';

/** Shared extraction used by every bank parser. */

/** "Rs.1,250.50" / "INR 1250" / "₹1,250" -> 1250.5 */
export function extractAmount(message: string): number | null {
  // Each numeric group must START with a digit. Without that anchor `[\d,]+`
  // happily matches the bare comma in "Dear Customer, Rs.3000.00", which then
  // parses to 0 and throws the whole message away.
  const match = message.match(
    /(?:rs\.?|inr|₹)\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i,
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
  if (
    /debited|spent|withdrawn|sent|paid|purchase|deducted|txn\s+(?:of|at)|used\s+(?:for|at)/.test(m)
  ) {
    return 'debit';
  }
  if (/credited|received|deposited|refund/.test(m)) return 'credit';
  return null;
}

/**
 * Messages that look like transactions but are not.
 *
 * This matters more than the parsing does. A missed spend is a gap you can
 * fill by hand; a one-time password turned into a ₹500 expense is a wrong
 * number in your dashboard that you have to hunt down and delete. Everything
 * here errs toward rejecting.
 */
export function isNotATransaction(message: string): boolean {
  const m = message.toLowerCase();
  return isCode(m) || isFutureOrFailed(m) || isPromotion(m) || isBalanceOnly(m);
}

/**
 * One-time passwords and their many aliases. Indian banks write these a dozen
 * ways and only some of them say "OTP" - IPPB and IOB both send plain
 * "verification code" messages, and those still quote a rupee amount.
 */
function isCode(m: string): boolean {
  return (
    /\botp\b/.test(m) ||
    /one[\s-]?time\s*(?:password|pin|passcode)/.test(m) ||
    /(?:verification|authentication|security|secure|access|login|activation)\s*code/.test(m) ||
    /\bpasscode\b|\bmpin\b|\bcvv\b/.test(m) ||
    /(?:do\s*not|don'?t|never)\s+share/.test(m) ||
    /valid\s+(?:for|till|upto|up\s+to)\s+\d+\s*(?:min|sec|hour)/.test(m) ||
    // "123456 is your code for ..." with no other framing.
    /\b\d{4,8}\b\s+is\s+(?:your|the)\b/.test(m)
  );
}

/** Something that has not happened, or happened and then did not. */
function isFutureOrFailed(m: string): boolean {
  return (
    /will\s+be\s+(?:debited|credited|charged|deducted|deducted)/.test(m) ||
    /is\s+due|due\s+on|due\s+date|reminder|scheduled\s+for/.test(m) ||
    /declined|failed|unsuccessful|reversed|refund\s+initiated|could\s+not\s+be/.test(m) ||
    /insufficient\s+(?:balance|funds)/.test(m) ||
    /mandate|e-?nach|autopay\s+set/.test(m)
  );
}

/**
 * Marketing. The dangerous ones are the offers that say "spend Rs.2000 and
 * get cashback", because "spend" is exactly the verb a real alert uses.
 */
function isPromotion(m: string): boolean {
  return (
    /cashback|offer\s+(?:valid|ends)|apply\s+now|t&c|terms\s+and\s+conditions/.test(m) ||
    /click\s+here|congratulations|limited\s+period|hurry|pre-?approved/.test(m) ||
    /voucher|discount|lowest\s+interest|eligible\s+for\s+a?\s*loan|avail\s+/.test(m) ||
    /\bwin\b|\bfree\b\s+(?:gift|trip|coupon)/.test(m)
  );
}

/**
 * A balance alert with no movement. Most are caught anyway because they carry
 * no debit or credit verb, but IPPB and CUB both send "Available balance in
 * your A/c ... is Rs.X" which reads close enough to matter.
 */
function isBalanceOnly(m: string): boolean {
  if (/debited|credited|spent|withdrawn|sent|deposited/.test(m)) return false;
  return /balance|bal\s*(?:is|:)/.test(m);
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
  // A cash withdrawal has no payee. "at IOB ATM" names the machine, not a
  // shop, and calling it a merchant would put "Iob Atm" in your category list.
  if (/\batms?\b|cash\s*(?:point|withdraw)/i.test(name)) return undefined;
  // "credited to your A/c XXXX1234" points at you, not at a payee. Every bank
  // phrases incoming money this way, and the payee slot must stay empty.
  if (/^(?:your|my|self|a\/?c|acct?|account)\b/i.test(name)) return undefined;
  if (/\ba\/c\b|\baccount\b/i.test(name)) return undefined;
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
