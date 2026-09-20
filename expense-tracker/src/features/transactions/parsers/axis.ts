import type { BankParser } from './types';
import { parseWith } from './generic';

/**
 * Axis uses "Info- UPI/P2M/<rrn>/<payee>" and, for cards, puts the merchant
 * after the timestamp with no label at all.
 */
export const axisParser: BankParser = {
  bank: 'Axis Bank',
  senderPattern: /AXISBK|AXISBN|AXIS/i,
  bodyPattern: /axis\s*bank/i,
  parse: (message) =>
    parseWith(message, {
      bank: 'Axis Bank',
      merchantPatterns: [
        /Info[\s:\-]+UPI[\/:]\s*(?:P2[MA][\/:])?\s*\d{6,20}[\/:]\s*([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /Info[\s:\-]+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /\d{1,2}:\d{2}(?::\d{2})?\s+(?:IST\s+)?(?:at\s+)?([A-Za-z][A-Za-z0-9@._&'\- ]{1,40}?)(?:\s+Avl|\s+Ref|$)/i,
      ],
    }),
};
