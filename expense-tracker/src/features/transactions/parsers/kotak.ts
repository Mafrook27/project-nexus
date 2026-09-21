import type { BankParser } from './types';
import { parseWith } from './generic';

/**
 * Kotak's UPI alerts end the payee at a full stop with no space before "UPI
 * Ref", so the payee has to be cut at the period rather than at whitespace.
 */
export const kotakParser: BankParser = {
  bank: 'Kotak Mahindra Bank',
  senderPattern: /KOTAKB|KMBANK|KOTAK/i,
  bodyPattern: /kotak/i,
  parse: (message) =>
    parseWith(message, {
      bank: 'Kotak Mahindra Bank',
      merchantPatterns: [
        /\bto\s+([A-Za-z0-9@._\-]{2,40}?)\s+on\b/i,
        /\bspent\s+on\s+Kotak\s+Bank\s+Card\s+\S+\s+at\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
      ],
    }),
};
