import type { BankParser } from './types';
import { parseWith } from './generic';

/**
 * City Union Bank.
 *
 * Puts the payee inside a "towards UPI/<rrn>/<payee>" clause, and its card
 * alerts read "Debit Card XX5678 used for Rs.X at <merchant>". Its sender ids
 * are inconsistent - CITYUB, CUBANK and CUBOTP all appear.
 */
export const cubParser: BankParser = {
  bank: 'City Union Bank',
  senderPattern: /CITYUB|CUBANK|CUBOTP|CUBSMS|\bCUB\b/i,
  bodyPattern: /city\s*union\s*bank|\bcub\b/i,
  parse: (message) =>
    parseWith(message, {
      bank: 'City Union Bank',
      merchantPatterns: [
        /towards\s+UPI[\/:]\s*\d{6,20}[\/:]\s*([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /towards\s+(?:UPI[\/:]\s*)?([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /\bused\s+for\s+Rs\.?\s*[\d,.]+\s+at\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /\bat\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
      ],
    }),
};
