/**
 * Pure finance math. No React, no DB - so the same functions run on the server
 * (dashboard summary) and in the browser (live calculator sliders).
 * Rates are always given as percentages, e.g. 12 means 12% a year.
 */

export const monthlyRate = (annualPct: number) => annualPct / 100 / 12;

/**
 * Future value of a monthly SIP, with an optional yearly step-up.
 *
 * The instalment is invested at the *start* of each month, so it earns that
 * month's return - an annuity due. That is what every SIP calculator in the
 * market reports, and it is what actually happens when a mandate debits on the
 * 5th and buys units the same day.
 */
export function sipFutureValue(
  monthly: number,
  annualReturnPct: number,
  years: number,
  stepUpPct = 0,
): number {
  const i = monthlyRate(annualReturnPct);
  let balance = 0;
  let contribution = monthly;
  const months = Math.round(years * 12);
  for (let m = 1; m <= months; m++) {
    balance = (balance + contribution) * (1 + i);
    if (m % 12 === 0) contribution *= 1 + stepUpPct / 100;
  }
  return balance;
}

export function sipInvested(monthly: number, years: number, stepUpPct = 0): number {
  let total = 0;
  let contribution = monthly;
  const months = Math.round(years * 12);
  for (let m = 1; m <= months; m++) {
    total += contribution;
    if (m % 12 === 0) contribution *= 1 + stepUpPct / 100;
  }
  return total;
}

/** Year-by-year series for the SIP growth chart. */
export function sipSeries(
  monthly: number,
  annualReturnPct: number,
  years: number,
  stepUpPct = 0,
  lumpsum = 0,
): { year: number; invested: number; value: number; gain: number }[] {
  const i = monthlyRate(annualReturnPct);
  const out: { year: number; invested: number; value: number; gain: number }[] = [];
  let balance = lumpsum;
  let invested = lumpsum;
  let contribution = monthly;
  const months = Math.round(years * 12);
  for (let m = 1; m <= months; m++) {
    balance = (balance + contribution) * (1 + i);
    invested += contribution;
    if (m % 12 === 0) {
      out.push({
        year: m / 12,
        invested: Math.round(invested),
        value: Math.round(balance),
        gain: Math.round(balance - invested),
      });
      contribution *= 1 + stepUpPct / 100;
    }
  }
  return out;
}

export function lumpsumFutureValue(amount: number, annualReturnPct: number, years: number): number {
  return amount * Math.pow(1 + annualReturnPct / 100, years);
}

/** Equated monthly instalment for a loan. */
export function emi(principal: number, annualRatePct: number, years: number): number {
  const i = monthlyRate(annualRatePct);
  const n = Math.round(years * 12);
  if (n <= 0) return 0;
  if (i === 0) return principal / n;
  const f = Math.pow(1 + i, n);
  return (principal * i * f) / (f - 1);
}

export function emiSchedule(principal: number, annualRatePct: number, years: number) {
  const i = monthlyRate(annualRatePct);
  const payment = emi(principal, annualRatePct, years);
  let balance = principal;
  let interestPaid = 0;
  const rows: { year: number; principalPaid: number; interestPaid: number; balance: number }[] = [];
  const months = Math.round(years * 12);
  for (let m = 1; m <= months; m++) {
    const interest = balance * i;
    balance = Math.max(0, balance + interest - payment);
    interestPaid += interest;
    if (m % 12 === 0 || m === months) {
      rows.push({
        year: Math.ceil(m / 12),
        principalPaid: Math.round(principal - balance),
        interestPaid: Math.round(interestPaid),
        balance: Math.round(balance),
      });
    }
  }
  return { payment, totalInterest: interestPaid, totalPaid: payment * months, rows };
}

/** Inflation-adjusted ("real") return, the right rate for retirement maths. */
export function realRate(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

/** Compound annual growth rate between two values. */
export function cagr(invested: number, current: number, years: number): number | null {
  if (invested <= 0 || years <= 0) return null;
  return (Math.pow(current / invested, 1 / years) - 1) * 100;
}

/** Months of runway a cash pile buys at a given monthly burn. */
export function runwayMonths(cash: number, monthlyExpense: number): number {
  if (monthlyExpense <= 0) return 0;
  return cash / monthlyExpense;
}

/** Number of months until a SIP + starting corpus reaches a target. */
export function monthsToTarget(
  current: number,
  monthly: number,
  annualReturnPct: number,
  target: number,
  maxMonths = 12 * 70,
): number | null {
  if (current >= target) return 0;
  if (monthly <= 0 && annualReturnPct <= 0) return null;
  const i = monthlyRate(annualReturnPct);
  let balance = current;
  for (let m = 1; m <= maxMonths; m++) {
    balance = (balance + monthly) * (1 + i);
    if (balance >= target) return m;
  }
  return null;
}
