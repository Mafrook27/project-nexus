import type { BankParser } from './types';
import { parseWith } from './generic';

/**
 * Indian Overseas Bank.
 *
 * Puts the reference before the payee - "by UPI Ref 5283.. to ZOMATO" - so the
 * payee has to be read after the reference rather than after the amount.
 * ("at IOB ATM" produces no merchant, but that rule lives in cleanMerchant -
 * every bank names its ATMs that way.)
 */
export const iobParser: BankParser = {
  bank: 'Indian Overseas Bank',
  senderPattern: /IOBCHN|IOBANK|IOBSMS|IOBOTP|\bIOB\b/i,
  bodyPattern: /\biob\b|indian\s*overseas/i,
  parse: (message) =>
    parseWith(message, {
      bank: 'Indian Overseas Bank',
      merchantPatterns: [
        /UPI\s*Ref\s*(?:no\.?)?\s*\d{6,20}\s+to\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /\bto\s+(?:vpa\s+)?([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /\bat\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
      ],
    }),
};
