import type { BankParser, ParsedTransaction } from './types';
import { genericParser, parseWith } from './generic';
import { hdfcParser } from './hdfc';
import { iciciParser } from './icici';
import { sbiParser } from './sbi';
import { axisParser } from './axis';
import { kotakParser } from './kotak';

export type { ParsedTransaction, PaymentMethod } from './types';
export { parseWith } from './generic';

/** Order matters only for body matching; sender matching is exact enough. */
export const PARSERS: BankParser[] = [
  hdfcParser,
  iciciParser,
  sbiParser,
  axisParser,
  kotakParser,
];

/**
 * Turns one bank SMS into a transaction, or null when the message is not one.
 *
 * The sender id decides the parser when it is available - it is the only part
 * of an SMS a bank cannot get wrong. Otherwise the body picks the bank, and
 * failing that the generic reader has a go.
 */
export function parseBankMessage(
  message: string,
  sender?: string,
): (ParsedTransaction & { parser: string }) | null {
  const parser = pickParser(message, sender);
  const parsed = parser ? parser.parse(message) : parseWith(message);
  if (!parsed) return null;
  return { ...parsed, parser: parser?.bank ?? genericParser.bank };
}

function pickParser(message: string, sender?: string): BankParser | null {
  if (sender) {
    const bySender = PARSERS.find((p) => p.senderPattern.test(sender));
    if (bySender) return bySender;
  }
  return PARSERS.find((p) => p.bodyPattern.test(message)) ?? null;
}
