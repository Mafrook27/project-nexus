import type { BankParser } from './types';
import { parseWith } from './generic';

/**
 * SBI writes long sentences: "debited by Rs.500 on 20/09/26 by transfer to
 * SWIGGY Ref No 123", and puts its UPI reference inside brackets.
 */
export const sbiParser: BankParser = {
  bank: 'State Bank of India',
  senderPattern: /SBIINB|SBIUPI|ATMSBI|CBSSBI|SBIBNK|SBI/i,
  bodyPattern: /\bsbi\b|state\s*bank/i,
  parse: (message) =>
    parseWith(message, {
      bank: 'State Bank of India',
      merchantPatterns: [
        /by\s+transfer\s+to\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /credited\s+to\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /\btrf\s+to\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
      ],
    }),
};
