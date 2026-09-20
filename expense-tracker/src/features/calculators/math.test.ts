import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cagr,
  emi,
  emiSchedule,
  lumpsumFutureValue,
  monthsToTarget,
  realRate,
  runwayMonths,
  sipFutureValue,
  sipInvested,
  sipSeries,
} from './math';

const close = (actual: number, expected: number, tolerance = 1) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

describe('sipFutureValue', () => {
  it('matches the standard annuity-due formula', () => {
    // ₹10,000/month at 12% for 10 years is ~₹23.23 lakh.
    close(sipFutureValue(10_000, 12, 10), 2_323_391, 500);
  });

  it('returns exactly the contributions when the return is zero', () => {
    assert.equal(sipFutureValue(5_000, 0, 3), 180_000);
  });

  it('grows with a yearly step-up', () => {
    const flat = sipFutureValue(10_000, 12, 10);
    const stepped = sipFutureValue(10_000, 12, 10, 10);
    assert.ok(stepped > flat * 1.4, 'a 10% step-up should add well over 40%');
  });

  it('counts stepped-up contributions correctly', () => {
    // Year 1: 12 × 1000. Year 2: 12 × 1100.
    assert.equal(sipInvested(1_000, 2, 10), 12_000 + 13_200);
  });
});

describe('sipSeries', () => {
  it('emits one point per completed year', () => {
    const series = sipSeries(10_000, 12, 5);
    assert.equal(series.length, 5);
    assert.equal(series[4].year, 5);
  });

  it('keeps value equal to invested plus gain', () => {
    for (const point of sipSeries(10_000, 12, 5)) {
      close(point.value, point.invested + point.gain, 2);
    }
  });

  it('includes an opening lumpsum in the invested total', () => {
    const [first] = sipSeries(1_000, 0, 1, 0, 50_000);
    assert.equal(first.invested, 62_000);
  });
});

describe('lumpsumFutureValue', () => {
  it('compounds annually', () => {
    close(lumpsumFutureValue(100_000, 10, 3), 133_100, 1);
  });
});

describe('emi', () => {
  it('matches a known home-loan instalment', () => {
    // ₹30L at 8.5% over 20 years is ~₹26,035 a month.
    close(emi(3_000_000, 8.5, 20), 26_035, 5);
  });

  it('is a simple division when interest is zero', () => {
    close(emi(120_000, 0, 1), 10_000, 0.01);
  });

  it('repays the whole principal by the final year', () => {
    const schedule = emiSchedule(1_000_000, 9, 10);
    close(schedule.rows.at(-1)!.balance, 0, 1);
    close(schedule.totalPaid, schedule.payment * 120, 1);
  });
});

describe('realRate', () => {
  it('is below the nominal rate once inflation bites', () => {
    close(realRate(12, 6), 5.66, 0.01);
  });

  it('is zero when returns only match inflation', () => {
    close(realRate(6, 6), 0, 1e-9);
  });
});

describe('monthsToTarget', () => {
  it('returns zero when the target is already met', () => {
    assert.equal(monthsToTarget(100, 10, 12, 50), 0);
  });

  it('finds the month the corpus crosses the target', () => {
    // No growth: 100 a month from zero reaches 1200 in 12 months.
    assert.equal(monthsToTarget(0, 100, 0, 1_200), 12);
  });

  it('gives up rather than looping forever when the target is unreachable', () => {
    assert.equal(monthsToTarget(0, 0, 0, 1_000), null);
  });
});

describe('small helpers', () => {
  it('computes CAGR', () => {
    close(cagr(100_000, 200_000, 5)!, 14.87, 0.01);
  });

  it('refuses a CAGR with no invested amount', () => {
    assert.equal(cagr(0, 1_000, 5), null);
  });

  it('turns cash into months of runway', () => {
    close(runwayMonths(300_000, 50_000), 6, 1e-9);
    assert.equal(runwayMonths(300_000, 0), 0);
  });
});
