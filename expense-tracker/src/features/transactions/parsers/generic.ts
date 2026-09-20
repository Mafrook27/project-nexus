import type { BankParser, ParsedTransaction, PaymentMethod } from './types';
import {
  cleanMerchant,
  detectDirection,
  detectPaymentMethod,
  extractAccountLast4,
  extractAmount,
  extractReference,
  extractTimestamp,
  isNotATransaction,
} from './helpers';

export type ParserConfig = {
  bank?: string;
  /**
   * Ordered patterns whose first capture group is the merchant. Banks differ
   * almost entirely in where they put the payee, so this is what a
   * bank-specific parser actually supplies.
   */
  merchantPatterns?: RegExp[];
  /** For banks with a date format the shared reader does not know. */
  timestamp?: (message: string) => string | undefined;
  /**
   * Some banks never write the word "UPI" - the shape of the sentence is the
   * only clue. This lets a bank parser say so.
   */
  paymentMethod?: (message: string) => PaymentMethod | undefined;
};

/** Patterns common to almost every Indian bank alert. */
const COMMON_MERCHANT_PATTERNS: RegExp[] = [
  /(?:trf\s+to|transfer\s+to|paid\s+to|sent\s+to)\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
  /\bto\s+(?:vpa\s+)?([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
  /\bat\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
];

const STOP_WORDS =
  /\s+(?:on|ref|refno|avl|avail|available|not\s+you|call|if\s+not|dt|date|bal|upi|txn)\b/i;

/**
 * Indian banks sign their messages with a trailing "-IOB" or "-City Union
 * Bank", and end the payee with a full stop. Both would otherwise be swallowed
 * into the merchant name.
 */
function trimTail(value: string): string {
  return value
    .split(/\s+-\s*[A-Za-z]/)[0] // " -IOB", " -City Union Bank"
    .split(/\.(?:\s|$)/)[0] // "ZOMATO. Avl Bal..."
    .replace(/[.,;:\s-]+$/, '')
    .trim();
}

/**
 * The shared read. Every bank parser is this function plus its own list of
 * places to look for the payee.
 */
export function parseWith(message: string, config: ParserConfig = {}): ParsedTransaction | null {
  if (!message || isNotATransaction(message)) return null;

  const amount = extractAmount(message);
  const direction = detectDirection(message);
  if (amount === null || !direction) return null;

  const patterns = [...(config.merchantPatterns ?? []), ...COMMON_MERCHANT_PATTERNS];
  const merchant = cleanMerchant(firstMatch(message, patterns));
  const accountLast4 = extractAccountLast4(message);
  const reference = extractReference(message);

  // Each recognised part is a reason to trust the read. Below 0.5 the review
  // queue asks instead of assuming.
  let confidence = 0.4;
  if (accountLast4) confidence += 0.15;
  if (reference) confidence += 0.2;
  if (merchant) confidence += 0.15;
  if (config.bank) confidence += 0.1;

  return {
    amount,
    direction,
    bank: config.bank,
    accountLast4,
    paymentMethod: config.paymentMethod?.(message) ?? detectPaymentMethod(message),
    merchant,
    reference,
    transactionAt: config.timestamp?.(message) ?? extractTimestamp(message),
    confidence: Math.min(confidence, 0.95),
  };
}

function firstMatch(message: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = message.match(pattern)?.[1];
    if (!found) continue;
    const trimmed = trimTail(found.split(STOP_WORDS)[0]);
    if (trimmed.length >= 2) return trimmed;
  }
  return undefined;
}

export const genericParser: BankParser = {
  bank: 'Unknown bank',
  senderPattern: /^\b$/,
  bodyPattern: /^\b$/,
  parse: (message) => parseWith(message),
};
