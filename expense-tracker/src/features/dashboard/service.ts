import 'server-only';
import type { Document } from 'mongodb';
import {
  budgets,
  goals,
  liabilities,
  recurring,
  snapshots,
  transactions,
  users,
} from '@/server/db/mongo';
import { lastNMonths, monthKey, monthRange, shiftMonth, toISODate } from '@/lib/date';
import { dashboardFacet, real } from './pipelines';
import { cashTotals } from '@/features/accounts/service';
import { portfolioSummary } from '@/features/investments/service';
import { computeFire, fireMilestones, type FireResult } from '@/features/fire/calc';
import { DEFAULT_FIRE_SETTINGS, type FireSettings } from '@/features/settings/schema';
import { runwayMonths, sipFutureValue } from '@/features/calculators/math';
import { TRANSACTION_LOOKUPS } from '@/features/transactions/service';

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard(userId: string, month = monthKey()) {
  const prev = shiftMonth(month, -1);
  const { start, end } = monthRange(month);
  const { start: prevStart, end: prevEnd } = monthRange(prev);
  const trendMonths = lastNMonths(12, month);
  const trendStart = monthRange(trendMonths[0]).start;
  const dueBy = toISODate(new Date(Date.now() + 21 * 86_400_000));

  const [
    user,
    cash,
    portfolio,
    facet,
    liabilityTotals,
    upcoming,
    goalRows,
    budgetRows,
    recentTx,
  ] = await Promise.all([
    users().findOne({ _id: userId }),
    cashTotals(userId),
    portfolioSummary(userId),
    // Nine of the old queries in one pass over the transactions this user owns
    // in the last twelve months. `$facet` runs each branch on the same input.
    transactions()
      .aggregate<FacetResult>(
        dashboardFacet(userId, { start, end, prevStart, prevEnd, trendStart }),
      )
      .toArray()
      .then((r) => r[0] ?? emptyFacet()),
    liabilities()
      .aggregate<{ outstanding: number; emi: number }>([
        { $match: { user_id: userId } },
        { $group: { _id: null, outstanding: { $sum: '$outstanding' }, emi: { $sum: '$emi' } } },
      ])
      .toArray()
      .then((r) => r[0] ?? { outstanding: 0, emi: 0 }),
    recurring()
      .aggregate([
        { $match: { user_id: userId, active: true, next_due: { $lte: dueBy } } },
        { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: '__c' } },
        { $lookup: { from: 'accounts', localField: 'account_id', foreignField: '_id', as: '__a' } },
        {
          $addFields: {
            id: '$_id',
            category_name: { $first: '$__c.name' },
            account_name: { $first: '$__a.name' },
          },
        },
        { $project: { __c: 0, __a: 0 } },
        { $sort: { next_due: 1 } },
        { $limit: 8 },
      ])
      .toArray(),
    goals().find({ user_id: userId }).sort({ target_date: 1, name: 1 }).toArray(),
    budgets()
      .aggregate<{
        category_id: string;
        amount: number;
        name: string;
        color: string;
        bucket: string;
      }>([
        { $match: { user_id: userId, month: { $in: ['default', month] } } },
        { $lookup: { from: 'categories', localField: 'category_id', foreignField: '_id', as: '__c' } },
        {
          $project: {
            _id: 0,
            category_id: 1,
            amount: 1,
            name: { $first: '$__c.name' },
            color: { $first: '$__c.color' },
            bucket: { $first: '$__c.bucket' },
          },
        },
      ])
      .toArray(),
    transactions()
      .aggregate([
        { $match: real(userId) },
        { $sort: { txn_date: -1, created_at: -1 } },
        { $limit: 8 },
        ...TRANSACTION_LOOKUPS,
        { $addFields: { id: '$_id' } },
      ])
      .toArray(),
  ]);

  const settings = { ...DEFAULT_FIRE_SETTINGS, ...((user?.settings ?? {}) as FireSettings) };
  const monthTotalsRow = facet.month[0] ?? blankTotals();
  const prevTotalsRow = facet.prevMonth[0] ?? blankTotals();

  const netWorth =
    cash.cash + portfolio.current - liabilityTotals.outstanding - cash.cardDues;

  const spendingMonths = facet.trend.filter((t) => t.expense > 0);
  const avgMonthlyExpense = spendingMonths.length
    ? spendingMonths.reduce((s, t) => s + t.expense, 0) / spendingMonths.length
    : settings.monthly_expenses;

  const fire: FireResult = computeFire({
    ...settings,
    monthly_expenses: settings.monthly_expenses || Math.round(avgMonthlyExpense),
    currentCorpus: portfolio.liquidCorpus + cash.emergency,
  });

  const emergencyTarget =
    (settings.monthly_expenses || avgMonthlyExpense) * settings.emergency_months;
  const emergency = {
    saved: cash.emergency,
    target: emergencyTarget,
    months: runwayMonths(cash.emergency, settings.monthly_expenses || avgMonthlyExpense),
    targetMonths: settings.emergency_months,
    pct: emergencyTarget > 0 ? Math.min(100, (cash.emergency / emergencyTarget) * 100) : 0,
  };

  await upsertSnapshot(userId, month, {
    cash: cash.cash,
    investments: portfolio.current,
    liabilities: liabilityTotals.outstanding + cash.cardDues,
    netWorth,
  });

  const netWorthTrend = await snapshots()
    .find({ user_id: userId, month: { $gte: trendMonths[0] } })
    .sort({ month: 1 })
    .toArray();

  const income = monthTotalsRow.income;
  const expense = monthTotalsRow.expense;

  const amountFor = (level: string) =>
    facet.needSplit.find((r) => r.need_level === level)?.amount ?? 0;
  const wasted = amountFor('waste');

  const spent = new Map(facet.budgetSpend.map((b) => [b._id, b.spent]));

  return {
    month,
    currency: user?.currency ?? 'INR',
    name: user?.name ?? 'You',
    settings,
    needsAttention: facet.needsAttention,
    cashflow: {
      salary: income,
      spent: expense,
      movedToSavings: monthTotalsRow.invested,
      leftOver: income - expense - monthTotalsRow.invested,
    },
    spendQuality: {
      needs: amountFor('need'),
      wants: amountFor('want'),
      wasted,
      wastedPct: expense > 0 ? (wasted / expense) * 100 : 0,
      categories: facet.wasteCategories,
      ifInvested: {
        fiveYears: sipFutureValue(wasted, settings.pre_retirement_return, 5),
        tenYears: sipFutureValue(wasted, settings.pre_retirement_return, 10),
      },
      trend: trendMonths.map((m) => {
        const row = facet.trend.find((t) => t.month === m);
        return { month: m, need: row?.need ?? 0, want: row?.want ?? 0, waste: row?.waste ?? 0 };
      }),
    },
    totals: {
      income,
      expense,
      net: income - expense,
      savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
      home: monthTotalsRow.home,
      personal: monthTotalsRow.personal,
      invested: monthTotalsRow.invested,
      prevIncome: prevTotalsRow.income,
      prevExpense: prevTotalsRow.expense,
      avgMonthlyExpense,
    },
    netWorth: {
      total: netWorth,
      cash: cash.cash,
      emergencyCash: cash.emergency,
      investments: portfolio.current,
      liabilities: liabilityTotals.outstanding + cash.cardDues,
      emi: liabilityTotals.emi,
    },
    portfolio,
    emergency,
    fire,
    milestones: fireMilestones(fire),
    trend: trendMonths.map((m) => {
      const row = facet.trend.find((t) => t.month === m);
      return {
        month: m,
        income: row?.income ?? 0,
        expense: row?.expense ?? 0,
        home: row?.home ?? 0,
        personal: row?.personal ?? 0,
        net: (row?.income ?? 0) - (row?.expense ?? 0),
      };
    }),
    netWorthTrend,
    byCategory: facet.byCategory,
    budgets: budgetRows
      .map((b) => ({ ...b, spent: spent.get(b.category_id) ?? 0 }))
      .sort((a, b) => b.spent - a.spent),
    topMerchants: facet.topMerchants,
    upcoming,
    goals: goalRows,
    recentTx,
  };
}

// ---------------------------------------------------------------------------

type MonthTotals = {
  income: number;
  expense: number;
  home: number;
  personal: number;
  invested: number;
};

type FacetResult = {
  month: MonthTotals[];
  prevMonth: MonthTotals[];
  byCategory: { id: string; name: string; color: string; bucket: string; amount: number }[];
  trend: {
    month: string;
    income: number;
    expense: number;
    home: number;
    personal: number;
    need: number;
    want: number;
    waste: number;
  }[];
  needSplit: { need_level: string; amount: number }[];
  wasteCategories: { name: string; color: string; amount: number; n: number }[];
  topMerchants: { merchant: string; amount: number; n: number }[];
  needsAttention: {
    id: string;
    amount: number;
    merchant: string | null;
    transaction_at: Date | null;
    source: string;
  }[];
  budgetSpend: { _id: string; spent: number }[];
};

const blankTotals = (): MonthTotals => ({
  income: 0,
  expense: 0,
  home: 0,
  personal: 0,
  invested: 0,
});

const emptyFacet = (): FacetResult => ({
  month: [],
  prevMonth: [],
  byCategory: [],
  trend: [],
  needSplit: [],
  wasteCategories: [],
  topMerchants: [],
  needsAttention: [],
  budgetSpend: [],
});

/** Keeps a monthly net-worth history so the chart builds up over time. */
async function upsertSnapshot(
  userId: string,
  month: string,
  v: { cash: number; investments: number; liabilities: number; netWorth: number },
) {
  await snapshots().updateOne(
    { user_id: userId, month },
    {
      $set: {
        cash: v.cash,
        investments: v.investments,
        liabilities: v.liabilities,
        net_worth: v.netWorth,
      },
      $setOnInsert: { _id: crypto.randomUUID(), created_at: new Date() },
    },
    { upsert: true },
  );
}
