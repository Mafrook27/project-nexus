/**
 * Real-shaped messages from the banks in use, for the tester page. Kept beside
 * the parsers so a new bank format can be pasted in here the day it changes.
 */
export type SampleMessage = {
  bank: string;
  sender: string;
  body: string;
  /** What should happen. Shown so a wrong result is obvious at a glance. */
  expect: 'spend' | 'income' | 'rejected';
  note?: string;
};

export const SAMPLE_MESSAGES: SampleMessage[] = [
  {
    bank: 'IPPB',
    sender: 'AD-IPPBNK',
    body: 'Dear Customer, your IPPB A/c XXXX1234 is debited with Rs.500.00 on 20-09-2026 and credited to swiggy@ybl. UPI Ref no 528312345678. -IPPB',
    expect: 'spend',
  },
  {
    bank: 'IPPB',
    sender: 'AD-IPPBNK',
    body: 'Dear Customer, Rs.3000.00 has been credited to your IPPB A/c XXXX1234 on 20-09-2026. -IPPB',
    expect: 'income',
    note: 'No payee: money coming in points at you, not a shop',
  },
  {
    bank: 'CUB',
    sender: 'AD-CITYUB',
    body: 'Your A/c XX4321 is debited by Rs.350.00 on 20-09-26 towards UPI/528399887766/ABC STORE -City Union Bank',
    expect: 'spend',
  },
  {
    bank: 'CUB',
    sender: 'AD-CUBANK',
    body: 'Your CUB Debit Card XX5678 used for Rs.899.00 at AMAZON on 20-09-26. Bal Rs.12,345.00',
    expect: 'spend',
    note: 'No debit verb at all, only "used for"',
  },
  {
    bank: 'SBI',
    sender: 'CP-SBIUPI',
    body: 'Dear UPI user A/C X5678 debited by Rs.190.0 on date 20Sep26 trf to ZOMATO Refno 528311223344. -SBI',
    expect: 'spend',
  },
  {
    bank: 'IOB',
    sender: 'AD-IOBCHN',
    body: 'Your A/c XXXXX9012 is debited by Rs.720.00 on 20-09-2026 by UPI Ref 528344556677 to BLINKIT. -IOB',
    expect: 'spend',
  },
  {
    bank: 'IOB',
    sender: 'AD-IOBCHN',
    body: 'Dear Customer, Rs.5000.00 withdrawn from A/c XXXX9012 at IOB ATM on 20/09/2026. -IOB',
    expect: 'spend',
    note: 'An ATM is not a shop, so the payee stays empty',
  },
  {
    bank: 'IPPB',
    sender: 'AD-IPPBNK',
    body: '123456 is the OTP for your IPPB transaction of Rs.500.00. Valid for 10 mins. Do not share with anyone. -IPPB',
    expect: 'rejected',
    note: 'Quotes an amount, must never become a spend',
  },
  {
    bank: 'SBI',
    sender: 'CP-SBIINB',
    body: 'Dear Customer, 998877 is the OTP for Rs.5000.00 txn at AMAZON on your SBI Debit Card. Do not share.',
    expect: 'rejected',
    note: 'Names an amount AND a merchant',
  },
  {
    bank: 'CUB',
    sender: 'AD-CUBANK',
    body: 'Spend Rs.2000 on your CUB Debit Card and get Rs.200 cashback! Offer valid till 30-09-26. T&C apply.',
    expect: 'rejected',
    note: 'Marketing that uses the word "spend"',
  },
  {
    bank: 'IOB',
    sender: 'AD-IOBCHN',
    body: 'Rs.2500.00 will be debited from your IOB A/c XXXX9012 on 25-09-2026 towards SIP. -IOB',
    expect: 'rejected',
    note: 'Has not happened yet',
  },
];
