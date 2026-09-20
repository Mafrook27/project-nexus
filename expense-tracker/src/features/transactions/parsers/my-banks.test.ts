import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBankMessage } from './index';

/**
 * The four banks actually in use: India Post Payments Bank, City Union Bank,
 * State Bank of India and Indian Overseas Bank.
 *
 * The rejection block is the important half. Every one-time password below is
 * a message that quotes a rupee amount, which is exactly what would turn into
 * a phantom expense if the reader were naive about it.
 */

describe('IPPB · India Post Payments Bank', () => {
  it('reads a UPI payment', () => {
    const r = parseBankMessage(
      'Dear Customer, your IPPB A/c XXXX1234 is debited with Rs.500.00 on 20-09-2026 and credited to swiggy@ybl. UPI Ref no 528312345678. -IPPB',
      'AD-IPPBNK',
    )!;
    assert.equal(r.amount, 500);
    assert.equal(r.direction, 'debit');
    assert.equal(r.bank, 'India Post Payments Bank');
    assert.equal(r.accountLast4, '1234');
    assert.equal(r.merchant, 'Swiggy');
    assert.equal(r.reference, '528312345678');
    assert.equal(r.paymentMethod, 'upi');
  });

  it('reads a credit into the account', () => {
    const r = parseBankMessage(
      'Rs.2000.00 credited to your IPPB Account XXXX1234 on 20-09-2026 by UPI Ref no 528377665544. -IPPB',
      'VM-IPPBNK',
    )!;
    assert.equal(r.amount, 2000);
    assert.equal(r.direction, 'credit');
    assert.equal(r.accountLast4, '1234');
  });

  it('does not treat "credited to your A/c" as a payee', () => {
    const r = parseBankMessage(
      'Rs.3000.00 has been credited to your IPPB A/c XXXX1234 on 20-09-2026. -IPPB',
      'AD-IPPBNK',
    )!;
    assert.equal(r.direction, 'credit');
    assert.equal(r.amount, 3000);
    assert.equal(r.merchant, undefined);
  });

  it('reads a doorstep cash deposit', () => {
    const r = parseBankMessage(
      'Dear Customer, Rs.3000.00 has been credited to your IPPB A/c XXXX1234 on 20-09-2026. -IPPB',
      'AD-IPPBNK',
    )!;
    assert.equal(r.amount, 3000);
    assert.equal(r.direction, 'credit');
  });
});

describe('CUB · City Union Bank', () => {
  it('reads a UPI debit with the towards clause', () => {
    const r = parseBankMessage(
      'Your A/c XX1234 is debited by Rs.350.00 on 20-09-26 towards UPI/528312345678/ABC STORE -City Union Bank',
      'AD-CITYUB',
    )!;
    assert.equal(r.amount, 350);
    assert.equal(r.bank, 'City Union Bank');
    assert.equal(r.accountLast4, '1234');
    assert.equal(r.merchant, 'Abc Store');
    assert.equal(r.reference, '528312345678');
  });

  it('reads a debit card purchase', () => {
    const r = parseBankMessage(
      'Your CUB Debit Card XX5678 used for Rs.899.00 at AMAZON on 20-09-26. Bal Rs.12,345.00',
      'AD-CUBANK',
    )!;
    assert.equal(r.amount, 899);
    assert.equal(r.merchant, 'Amazon');
    assert.equal(r.accountLast4, '5678');
    assert.equal(r.paymentMethod, 'card');
  });

  it('reads an ATM withdrawal', () => {
    const r = parseBankMessage(
      'Dear Customer, Rs.1500.00 has been debited from your CUB A/c XXXXXX1234 on 20/09/2026 through ATM.',
      'AD-CITYUB',
    )!;
    assert.equal(r.amount, 1500);
    assert.equal(r.direction, 'debit');
    assert.equal(r.paymentMethod, 'atm');
  });

  it('is not confused by a trailing balance', () => {
    const r = parseBankMessage(
      'Your A/c XX1234 is debited by Rs.240.00 on 20-09-26 towards UPI/528300011122/BLINKIT. Bal Rs.9,870.50 -CUB',
      'AD-CITYUB',
    )!;
    assert.equal(r.amount, 240);
    assert.equal(r.merchant, 'Blinkit');
  });
});

describe('SBI · State Bank of India', () => {
  it('reads a UPI debit', () => {
    const r = parseBankMessage(
      'Dear UPI user A/C X1234 debited by Rs.190.0 on date 20Sep26 trf to ZOMATO Refno 528312345678. -SBI',
      'CP-SBIUPI',
    )!;
    assert.equal(r.amount, 190);
    assert.equal(r.bank, 'State Bank of India');
    assert.equal(r.merchant, 'Zomato');
    assert.equal(r.reference, '528312345678');
  });

  it('reads a salary credit', () => {
    const r = parseBankMessage(
      'Your A/c XXXXX5678 is credited by Rs.45000.00 on 01-09-26 by transfer from EMPLOYER PVT LTD Ref No 445566778899 -SBI',
      'CP-SBIINB',
    )!;
    assert.equal(r.amount, 45000);
    assert.equal(r.direction, 'credit');
  });
});

describe('IOB · Indian Overseas Bank', () => {
  it('reads a UPI debit where the reference comes before the payee', () => {
    const r = parseBankMessage(
      'Your A/c XXXXX1234 is debited by Rs.720.00 on 20-09-2026 by UPI Ref 528312345678 to ZOMATO. -IOB',
      'AD-IOBCHN',
    )!;
    assert.equal(r.amount, 720);
    assert.equal(r.bank, 'Indian Overseas Bank');
    assert.equal(r.accountLast4, '1234');
    assert.equal(r.merchant, 'Zomato');
    assert.equal(r.reference, '528312345678');
    assert.equal(r.paymentMethod, 'upi');
  });

  it('reads an ATM withdrawal without inventing a shop', () => {
    const r = parseBankMessage(
      'Dear Customer, Rs.5000.00 withdrawn from A/c XXXX1234 at IOB ATM on 20/09/2026. -IOB',
      'AD-IOBCHN',
    )!;
    assert.equal(r.amount, 5000);
    assert.equal(r.direction, 'debit');
    assert.equal(r.paymentMethod, 'atm');
    assert.equal(r.merchant, undefined);
  });

  it('reads a salary credit', () => {
    const r = parseBankMessage(
      'Your IOB A/c XXXX1234 credited with Rs.25000.00 on 01-09-2026 towards SALARY. -Indian Overseas Bank',
      'AD-IOBCHN',
    )!;
    assert.equal(r.amount, 25000);
    assert.equal(r.direction, 'credit');
  });
});

/**
 * Every message below quotes a rupee amount and several use the word
 * "transaction". None of them may ever become a spend.
 */
describe('one-time passwords from these four banks', () => {
  const otps: [string, string][] = [
    ['AD-IPPBNK', '123456 is the OTP for your IPPB transaction of Rs.500.00. Valid for 10 mins. Do not share with anyone. -IPPB'],
    ['AD-IPPBNK', 'Dear Customer, 456789 is your OTP for login to IPPB Mobile Banking. Never share this with anyone. -IPPB'],
    ['IPPBOTP', 'Use verification code 998877 to authorise Rs.2,500.00 debit from your IPPB A/c XXXX1234.'],
    ['AD-CITYUB', 'OTP for your CUB transaction of Rs.1500.00 is 123456. Valid for 5 minutes. Do not share. -City Union Bank'],
    ['CUBOTP', '445566 is your One Time Password for CUB NetBanking. Amount Rs.899.00. Do not share this OTP.'],
    ['AD-CUBANK', 'Your CUB secure code is 778899 for a transaction of Rs.350 at ABC STORE.'],
    ['CP-SBIINB', 'Dear Customer, 998877 is the OTP for Rs.5000.00 txn at AMAZON on your SBI Debit Card. Do not share.'],
    ['CP-SBIINB', 'OTP 112233 for INB login. Never share your OTP, PIN or CVV with anyone. -SBI'],
    ['AD-IOBCHN', '123456 is your OTP for IOB NetBanking transaction of Rs.720.00. Do not share it with anyone. -Indian Overseas Bank'],
    ['IOBOTP', 'Dear Customer, your authentication code for IOB transaction Rs.5,000 is 665544. Valid for 3 min.'],
  ];

  for (const [sender, message] of otps) {
    it(`rejects: ${message.slice(0, 50)}…`, () => {
      assert.equal(parseBankMessage(message, sender), null);
    });
  }
});

describe('other messages that must never become a spend', () => {
  const junk: [string, string][] = [
    ['AD-IPPBNK', 'Available balance in your IPPB A/c XXXX1234 is Rs.12,345.67 as on 20-09-2026. -IPPB'],
    ['AD-CITYUB', 'Your CUB A/c XX1234 balance is Rs.8,500.00. -City Union Bank'],
    ['AD-IOBCHN', 'Rs.2500.00 will be debited from your IOB A/c XXXX1234 on 25-09-2026 towards SIP. -IOB'],
    ['CP-SBIINB', 'Your transaction of Rs.1200.00 at BIGBAZAAR was declined due to insufficient balance. -SBI'],
    ['AD-CUBANK', 'Spend Rs.2000 on your CUB Debit Card and get Rs.200 cashback! Offer valid till 30-09-26. T&C apply.'],
    ['AD-IPPBNK', 'Congratulations! You are pre-approved for a personal loan up to Rs.5,00,000. Apply now. -IPPB'],
    ['AD-IOBCHN', 'Your IOB e-mandate of Rs.1500.00 for NETFLIX has been set up successfully. -IOB'],
    ['AD-CITYUB', 'Reminder: Your CUB credit card payment of Rs.4,500.00 is due on 25-09-2026.'],
  ];

  for (const [sender, message] of junk) {
    it(`rejects: ${message.slice(0, 50)}…`, () => {
      assert.equal(parseBankMessage(message, sender), null);
    });
  }
});

describe('the right parser is chosen', () => {
  const cases: [string, string, string][] = [
    ['AD-IPPBNK', 'Rs.100 debited from A/c XX1111 to SHOP', 'India Post Payments Bank'],
    ['AD-CITYUB', 'Rs.100 debited from A/c XX1111 to SHOP', 'City Union Bank'],
    ['AD-IOBCHN', 'Rs.100 debited from A/c XX1111 to SHOP', 'Indian Overseas Bank'],
    ['CP-SBIINB', 'Rs.100 debited from A/c XX1111 to SHOP', 'State Bank of India'],
  ];
  for (const [sender, message, bank] of cases) {
    it(`${sender} → ${bank}`, () => {
      assert.equal(parseBankMessage(message, sender)?.bank, bank);
    });
  }

  it('falls back to the body when the sender id is missing', () => {
    const r = parseBankMessage(
      'Your A/c XXXXX1234 is debited by Rs.720.00 by UPI Ref 528312345678 to ZOMATO. -Indian Overseas Bank',
    )!;
    assert.equal(r.bank, 'Indian Overseas Bank');
  });
});
