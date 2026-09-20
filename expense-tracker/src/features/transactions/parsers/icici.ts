import type { BankParser } from './types';
import { parseWith } from './generic';

/**
 * ICICI hides the payee in an "Info:" field, usually as the last segment of a
 * `UPI/<rrn>/<payee>` path, and its card alerts name the merchant after "at".
 */
export const iciciParser: BankParser = {
  bank: 'ICICI Bank',
  senderPattern: /ICICIB|ICICIT|ICICI/i,
  bodyPattern: /icici\s*bank|icicibank/i,
  parse: (message) =>
    parseWith(message, {
      bank: 'ICICI Bank',
      merchantPatterns: [
        /Info\s*[:\-]\s*UPI[\/:]\s*\d{6,20}[\/:]\s*([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /Info\s*[:\-]\s*(?:UPI[\/:]\s*)?([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
        /;\s*([A-Za-z][A-Za-z0-9@._&'\- ]{1,40}?)\s+credited/i,
        /\bat\s+([A-Za-z][A-Za-z0-9@._&'\- ]{1,40})/i,
      ],
    }),
};
