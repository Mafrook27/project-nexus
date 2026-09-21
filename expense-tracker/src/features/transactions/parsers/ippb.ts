import type { BankParser } from './types';
import { parseWith } from './generic';

/**
 * India Post Payments Bank.
 *
 * Writes the full "debited ... and credited to <vpa>" sentence, so the payee
 * follows the *second* verb. Its reference is labelled "UPI Ref no", and most
 * of its alerts end with a bare "-IPPB" signature rather than naming the bank
 * in the body.
 */
export const ippbParser: BankParser = {
  bank: 'India Post Payments Bank',
  senderPattern: /IPPBNK|IPPBOT|IPPBSM|\bIPPB\b/i,
  bodyPattern: /\bippb\b|india\s*post\s*payments/i,
  parse: (message) =>
    parseWith(message, {
      bank: 'India Post Payments Bank',
      merchantPatterns: [
        /(?:and\s+)?credited\s+to\s+([A-Za-z0-9][A-Za-z0-9@._&'\- ]{1,40})/i,
        /\bto\s+(?:vpa\s+)?([A-Za-z0-9][A-Za-z0-9@._&'\- ]{1,40})/i,
      ],
    }),
};
