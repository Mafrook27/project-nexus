/**
 * FIRE = Financial Independence, Retire Early.
 *
 * The one number that matters is the corpus that can fund your expenses forever
 * at a safe withdrawal rate. Everything else here is a variation on it.
 */
import { DEFAULT_FIRE_SETTINGS, type FireSettings } from '@/features/settings/schema';
import { monthsToTarget, realRate } from '@/features/calculators/math';

export type FireInput = Required<FireSettings> & {
  /** Investments that can actually be spent (excludes PPF/EPF lock-ins if you say so). */
  currentCorpus: number;
};

export type FireResult = {
  /** Corpus needed, expressed in today's rupees. */
  fiNumberToday: number;
  /** Same corpus but at the retirement date, after inflation. */
  fiNumberAtRetirement: number;
  leanFiNumber: number;
  fatFiNumber: number;
  coastFiNumber: number;
  /** 0 - 100 */
  progressPct: number;
  currentCorpus: number;
  annualExpensesToday: number;
  annualExpensesAtRetirement: number;
  /** Safe monthly spend your corpus supports right now. */
  safeMonthlyWithdrawalNow: number;
  monthsToFi: number | null;
  fiAge: number | null;
  yearsToTargetAge: number;
  onTrack: boolean;
  achieved: boolean;
  shortfall: number;
  /** Projection for the chart. */
  projection: { age: number; corpus: number; target: number }[];
};

export function computeFire(input: FireInput): FireResult {
  const s = { ...DEFAULT_FIRE_SETTINGS, ...input };
  const {
    current_age,
    retire_age,
    monthly_expenses,
    expense_ratio_in_retirement,
    inflation,
    pre_retirement_return,
    withdrawal_rate,
    monthly_investment,
    currentCorpus,
  } = { ...s, currentCorpus: input.currentCorpus };

  const yearsToTargetAge = Math.max(0, retire_age - current_age);
  const retirementFactor = expense_ratio_in_retirement / 100;
  const annualExpensesToday = monthly_expenses * 12 * retirementFactor;
  const annualExpensesAtRetirement =
    annualExpensesToday * Math.pow(1 + inflation / 100, yearsToTargetAge);

  const swr = withdrawal_rate / 100;
  const fiNumberToday = swr > 0 ? annualExpensesToday / swr : 0;
  const fiNumberAtRetirement = swr > 0 ? annualExpensesAtRetirement / swr : 0;

  // Coast FIRE: stop investing today and still land on the number by retirement.
  const coastFiNumber =
    fiNumberAtRetirement / Math.pow(1 + pre_retirement_return / 100, Math.max(yearsToTargetAge, 0));

  const progressPct = fiNumberToday > 0 ? Math.min(100, (currentCorpus / fiNumberToday) * 100) : 0;

  // Work in real (inflation-adjusted) terms so the target stays fixed in today's money.
  const real = realRate(pre_retirement_return, inflation);
  const months = monthsToTarget(currentCorpus, monthly_investment, real, fiNumberToday);
  const fiAge = months === null ? null : current_age + months / 12;

  const projection: { age: number; corpus: number; target: number }[] = [];
  const horizon = Math.max(yearsToTargetAge, months ? Math.ceil(months / 12) : 0, 10) + 5;
  let corpus = currentCorpus;
  const monthlyReal = real / 100 / 12;
  projection.push({
    age: Math.round(current_age),
    corpus: Math.round(corpus),
    target: Math.round(fiNumberToday),
  });
  for (let y = 1; y <= horizon; y++) {
    for (let m = 0; m < 12; m++) corpus = (corpus + monthly_investment) * (1 + monthlyReal);
    projection.push({
      age: Math.round(current_age + y),
      corpus: Math.round(corpus),
      target: Math.round(fiNumberToday),
    });
  }

  return {
    fiNumberToday,
    fiNumberAtRetirement,
    leanFiNumber: fiNumberToday * 0.7,
    fatFiNumber: fiNumberToday * 1.5,
    coastFiNumber,
    progressPct,
    currentCorpus,
    annualExpensesToday,
    annualExpensesAtRetirement,
    safeMonthlyWithdrawalNow: (currentCorpus * swr) / 12,
    monthsToFi: months,
    fiAge,
    yearsToTargetAge,
    onTrack: fiAge !== null && fiAge <= retire_age,
    achieved: currentCorpus >= fiNumberToday && fiNumberToday > 0,
    shortfall: Math.max(0, fiNumberToday - currentCorpus),
    projection,
  };
}

export function fireMilestones(result: FireResult) {
  const { currentCorpus } = result;
  return [
    { label: 'Emergency ready', target: result.annualExpensesToday * 0.5 },
    { label: 'Coast FIRE', target: result.coastFiNumber },
    { label: 'Lean FIRE', target: result.leanFiNumber },
    { label: 'FIRE', target: result.fiNumberToday },
    { label: 'Fat FIRE', target: result.fatFiNumber },
  ].map((m) => ({
    ...m,
    reached: currentCorpus >= m.target,
    pct: m.target > 0 ? Math.min(100, (currentCorpus / m.target) * 100) : 0,
  }));
}
