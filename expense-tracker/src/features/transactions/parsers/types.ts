/**
 * Shared shape every bank parser produces. Deliberately free of React, Node
 * and database imports so the Android companion can import this folder as-is.
 */

export type PaymentMethod = 'upi' | 'card' | 'cash' | 'bank_transfer' | 'atm' | 'unknown';

export type ParsedTransaction = {
  amount: number;
  direction: 'debit' | 'credit';
  bank?: string;
  accountLast4?: string;
  paymentMethod: PaymentMethod;
  merchant?: string;
  /** The bank's own reference: UPI RRN, NEFT UTR, card auth code. */
  reference?: string;
  /** ISO instant, only when the message actually carried a date. */
  transactionAt?: string;
  /** 0-1. Below 0.5 the app asks rather than assumes. */
  confidence: number;
};

export type BankParser = {
  /** Display name stored on the transaction. */
  bank: string;
  /** Matches the SMS sender id, e.g. VM-HDFCBK or AD-ICICIB. */
  senderPattern: RegExp;
  /** Matches the body, for when the sender id is missing or rewritten. */
  bodyPattern: RegExp;
  parse: (message: string) => ParsedTransaction | null;
};
