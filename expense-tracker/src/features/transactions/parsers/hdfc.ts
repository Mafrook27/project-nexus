import type { BankParser } from './types';
import { parseWith } from './generic';

/**
 * HDFC puts the payee between "To" and "On", and its card alerts use an
 * unusual `YYYY-MM-DD:HH:MM:SS` stamp that the shared date reader misreads.
 */
export const hdfcParser: BankParser = {
  bank: 'HDFC Bank',
  senderPattern: /HDFCBK|HDFCBN|HDFCB/i,
  bodyPattern: /hdfc\s*bank|hdfcbank/i,
  parse: (message) =>
    parseWith(message, {
      bank: 'HDFC Bank',
      merchantPatterns: [
        /\bTo\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40}?)\s+On\b/i,
        /\bspent\s+on\s+HDFC\s+Bank\s+Card\s+\S+\s+at\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /\bto\s+VPA\s+([A-Za-z0-9@._\-]{2,40})/i,
      ],
      timestamp: hdfcTimestamp,
      paymentMethod: hdfcPaymentMethod,
    }),
};

/**
 * HDFC's UPI alert never contains the word "UPI". Its shape is the signature:
 * "Sent Rs.X From HDFC Bank A/C x1234 To <payee>".
 */
function hdfcPaymentMethod(message: string): 'upi' | undefined {
  return /\bsent\b[\s\S]*\bfrom\b[\s\S]*\ba\/c\b[\s\S]*\bto\b/i.test(message)
    ? 'upi'
    : undefined;
}

function hdfcTimestamp(message: string): string | undefined {
  const match = message.match(/(\d{4})-(\d{2})-(\d{2}):(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match.map(Number) as unknown as number[];
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
