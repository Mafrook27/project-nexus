import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBankMessage } from './index';
import { cleanMerchant, extractAmount, extractReference, isNotATransaction } from './helpers';

describe('HDFC', () => {
  it('reads a UPI debit', () => {
    const r = parseBankMessage(
      'Sent Rs.450.00 From HDFC Bank A/C x1234 To Swiggy On 20/09/26 Ref 528312345678. Not You? Call 18002586161',
      'VM-HDFCBK',
    )!;
    assert.equal(r.amount, 450);
    assert.equal(r.direction, 'debit');
    assert.equal(r.bank, 'HDFC Bank');
    assert.equal(r.accountLast4, '1234');
    assert.equal(r.merchant, 'Swiggy');
    assert.equal(r.reference, '528312345678');
    assert.equal(r.paymentMethod, 'upi');
  });

  it('reads a card spend with the colon timestamp', () => {
    const r = parseBankMessage(
      'Rs 1250.00 spent on HDFC Bank Card x9012 at AMAZON on 2026-09-20:13:10:00. Avl Lmt Rs 48,750',
      'AD-HDFCBK',
    )!;
    assert.equal(r.amount, 1250);
    assert.equal(r.merchant, 'Amazon');
    assert.equal(r.accountLast4, '9012');
    assert.equal(r.paymentMethod, 'card');
    assert.equal(new Date(r.transactionAt!).getFullYear(), 2026);
    assert.equal(new Date(r.transactionAt!).getHours(), 13);
  });
});

describe('ICICI', () => {
  it('reads the Info: UPI path', () => {
    const r = parseBankMessage(
      'INR 500.00 debited from A/c XX4321 on 20-Sep-26. Info: UPI/528312345678/Swiggy. Avl Bal INR 12,345.67',
      'AD-ICICIB',
    )!;
    assert.equal(r.amount, 500);
    assert.equal(r.bank, 'ICICI Bank');
    assert.equal(r.accountLast4, '4321');
    assert.equal(r.merchant, 'Swiggy');
    assert.equal(r.reference, '528312345678');
  });

  it('reads the "; MERCHANT credited" form as a debit', () => {
    const r = parseBankMessage(
      'ICICI Bank Acct XX4321 debited for Rs 320.00 on 20-Sep-26; ZOMATO credited. UPI:528399887766',
      'AD-ICICIB',
    )!;
    assert.equal(r.direction, 'debit');
    assert.equal(r.amount, 320);
    assert.equal(r.merchant, 'Zomato');
    assert.equal(r.reference, '528399887766');
  });
});

describe('SBI', () => {
  it('reads the long transfer sentence', () => {
    const r = parseBankMessage(
      'Dear Customer, Your A/C XXXXX5678 has been debited by Rs.500.0 on 20/09/26 by transfer to SWIGGY Ref No 528312345678 -SBI',
      'CP-SBIINB',
    )!;
    assert.equal(r.amount, 500);
    assert.equal(r.bank, 'State Bank of India');
    assert.equal(r.accountLast4, '5678');
    assert.equal(r.merchant, 'Swiggy');
    assert.equal(r.reference, '528312345678');
  });
});

describe('payment method', () => {
  it('calls a plain bank transfer what it is', () => {
    const r = parseBankMessage(
      'Dear Customer, Your A/C XXXXX5678 has been debited by Rs.1499.0 on 20/09/26 by transfer to CROMA Ref No 900099900011 -SBI',
      'CP-SBIINB',
    )!;
    assert.equal(r.paymentMethod, 'bank_transfer');
    assert.equal(r.merchant, 'Croma');
  });

  it('still prefers UPI when the alert names it', () => {
    const r = parseBankMessage(
      'INR 500.00 debited from A/c XX4321 on 20-Sep-26. Info: UPI/528312345678/Swiggy transfer',
      'AD-ICICIB',
    )!;
    assert.equal(r.paymentMethod, 'upi');
  });
});

describe('Axis', () => {
  it('reads the UPI/P2M path', () => {
    const r = parseBankMessage(
      'INR 280.00 debited from A/c no. XX7788 on 20-09-26, 13:10:00 IST. Info- UPI/P2M/528312345678/BLINKIT',
      'AD-AXISBK',
    )!;
    assert.equal(r.amount, 280);
    assert.equal(r.bank, 'Axis Bank');
    assert.equal(r.accountLast4, '7788');
    assert.equal(r.merchant, 'Blinkit');
    assert.equal(r.paymentMethod, 'upi');
  });
});

describe('Kotak', () => {
  it('reads a VPA payee and strips the handle', () => {
    const r = parseBankMessage(
      'Sent Rs.390.00 from Kotak Bank AC X2468 to swiggy@ybl on 20-09-26. UPI Ref 528344556677.',
      'VK-KOTAKB',
    )!;
    assert.equal(r.amount, 390);
    assert.equal(r.bank, 'Kotak Mahindra Bank');
    assert.equal(r.accountLast4, '2468');
    assert.equal(r.merchant, 'Swiggy');
    assert.equal(r.reference, '528344556677');
  });
});

describe('the generic fallback', () => {
  it('still reads a bank it has never seen', () => {
    const r = parseBankMessage(
      'Rs.750.00 debited from A/c XX3333 towards purchase at BIGBASKET. Ref 998877665544',
      'AD-YESBNK',
    )!;
    assert.equal(r.amount, 750);
    assert.equal(r.direction, 'debit');
    assert.equal(r.accountLast4, '3333');
    assert.equal(r.reference, '998877665544');
  });

  it('is less confident than a bank it knows', () => {
    const known = parseBankMessage(
      'Sent Rs.450.00 From HDFC Bank A/C x1234 To Swiggy On 20/09/26 Ref 528312345678',
      'VM-HDFCBK',
    )!;
    const unknown = parseBankMessage(
      'Rs.450.00 debited from A/c XX1234 to Swiggy Ref 528312345678',
      'AD-NOBANK',
    )!;
    assert.ok(known.confidence > unknown.confidence);
  });

  it('reads ATM withdrawals', () => {
    const r = parseBankMessage(
      'Rs 2000 withdrawn from A/c XX1234 at ATM on 20-09-26. Avl Bal Rs 8,000',
      'AD-HDFCBK',
    )!;
    assert.equal(r.amount, 2000);
    assert.equal(r.paymentMethod, 'atm');
    assert.equal(r.direction, 'debit');
  });

  it('reads a salary credit', () => {
    const r = parseBankMessage(
      'Your A/c XX1234 is credited with INR 1,50,000.00 on 01-09-26 by NEFT Ref 445566778899',
      'AD-HDFCBK',
    )!;
    assert.equal(r.amount, 150000);
    assert.equal(r.direction, 'credit');
    assert.equal(r.paymentMethod, 'bank_transfer');
  });
});

describe('what must NOT become a transaction', () => {
  const junk = [
    '123456 is your OTP for a transaction of Rs.500 on HDFC Bank Card. Do not share it with anyone.',
    'Your A/c XX1234 balance is Rs.12,345.67 as on 20-09-26.',
    'Rs.500 will be debited from your A/c XX1234 on 25-09-26 towards your SIP.',
    'Your transaction of Rs.500 at AMAZON was declined due to insufficient balance.',
    'Get a personal loan up to Rs.5,00,000 at 10.5% interest. Apply now!',
  ];
  for (const message of junk) {
    it(`ignores: ${message.slice(0, 44)}…`, () => {
      assert.equal(parseBankMessage(message, 'AD-HDFCBK'), null);
    });
  }
});

describe('helpers', () => {
  it('reads every way a rupee amount is written', () => {
    assert.equal(extractAmount('Rs.1,250.50 debited'), 1250.5);
    assert.equal(extractAmount('INR 500 debited'), 500);
    assert.equal(extractAmount('₹1,50,000 credited'), 150000);
    assert.equal(extractAmount('no money here'), null);
  });

  it('reads references however they are labelled', () => {
    assert.equal(extractReference('Ref No 528312345678'), '528312345678');
    assert.equal(extractReference('UPI Ref 528312345678.'), '528312345678');
    assert.equal(extractReference('RRN: 123456789012'), '123456789012');
    assert.equal(extractReference('UTR-AXISN12345678'), 'AXISN12345678');
    assert.equal(extractReference('nothing to see'), undefined);
  });

  it('tidies merchant names', () => {
    assert.equal(cleanMerchant('VPA swiggy@ybl'), 'Swiggy');
    assert.equal(cleanMerchant('AMAZON RETAIL INDIA PVT LTD'), 'Amazon Retail');
    assert.equal(cleanMerchant('  zomato  '), 'Zomato');
    assert.equal(cleanMerchant('BigBasket'), 'BigBasket');
    assert.equal(cleanMerchant('123456'), undefined);
    assert.equal(cleanMerchant(undefined), undefined);
  });

  it('spots messages that only look like transactions', () => {
    assert.equal(isNotATransaction('Your OTP is 123456'), true);
    assert.equal(isNotATransaction('Rs.500 debited from A/c XX1234'), false);
  });
});
