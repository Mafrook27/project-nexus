import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guessColumn, normaliseDate, parseCsvAmount, COLUMN_HINTS } from './csv';

describe('normaliseDate', () => {
  it('passes ISO dates through', () => {
    assert.equal(normaliseDate('2026-03-14'), '2026-03-14');
    assert.equal(normaliseDate('2026/3/4'), '2026-03-04');
  });

  it('reads Indian day-first dates', () => {
    assert.equal(normaliseDate('14/03/2026'), '2026-03-14');
    assert.equal(normaliseDate('14-03-26'), '2026-03-14');
    assert.equal(normaliseDate('01.09.2026'), '2026-09-01');
  });

  it('reads dates with a month name', () => {
    assert.equal(normaliseDate('14 Mar 2026'), '2026-03-14');
    assert.equal(normaliseDate('5-Jan-26'), '2026-01-05');
  });

  it('returns null for junk', () => {
    assert.equal(normaliseDate(''), null);
    assert.equal(normaliseDate('not a date'), null);
  });
});

describe('parseCsvAmount', () => {
  it('strips symbols and separators', () => {
    assert.equal(parseCsvAmount('₹1,20,000.50'), 120000.5);
    assert.equal(parseCsvAmount('2480.50'), 2480.5);
  });

  it('understands both ways of writing a negative', () => {
    assert.equal(parseCsvAmount('-4875.00'), -4875);
    assert.equal(parseCsvAmount('(4875.00)'), -4875);
  });

  it('returns null when there is no number', () => {
    assert.equal(parseCsvAmount(''), null);
    assert.equal(parseCsvAmount('  '), null);
  });
});

describe('guessColumn', () => {
  const headers = ['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'];

  it('prefers an exact header match', () => {
    assert.equal(guessColumn(headers, [...COLUMN_HINTS.date]), 'Date');
  });

  it('falls back to a partial match', () => {
    assert.equal(guessColumn(headers, [...COLUMN_HINTS.credit]), 'Deposit Amt.');
    assert.equal(guessColumn(headers, [...COLUMN_HINTS.description]), 'Narration');
  });

  it('returns an empty string when nothing fits', () => {
    assert.equal(guessColumn(headers, ['isin', 'folio']), '');
  });
});
