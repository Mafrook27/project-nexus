/** Option lists for the transaction-intelligence fields. */

export const TXN_SOURCES = [
  { value: 'manual', label: 'Added by you' },
  { value: 'sms', label: 'Bank SMS' },
  { value: 'notification', label: 'App notification' },
  { value: 'import', label: 'CSV import' },
] as const;
export type TxnSource = (typeof TXN_SOURCES)[number]['value'];

export const TXN_STATUSES = [
  { value: 'detected', label: 'Needs a look' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'categorized', label: 'Sorted' },
  { value: 'ignored', label: 'Ignored' },
] as const;
export type TxnStatus = (typeof TXN_STATUSES)[number]['value'];

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'atm', label: 'ATM' },
  { value: 'unknown', label: 'Not known' },
] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value'];

/** Anything not in this list is money that left or entered your account. */
export const COUNTED_STATUSES: TxnStatus[] = ['detected', 'confirmed', 'categorized'];

/** SQL fragment: every query about real money uses this. */
export const NOT_IGNORED = `status <> 'ignored'`;

/**
 * How far apart two records of the same payment can be and still be the same
 * payment. A Google Pay notification and the bank's SMS usually land within a
 * minute of each other; two minutes is comfortable without swallowing a
 * genuine second purchase at the same shop.
 */
export const DEDUPE_WINDOW_SECONDS = 120;
