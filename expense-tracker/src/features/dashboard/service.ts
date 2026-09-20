import 'server-only';
import { query, one } from '@/server/db/client';
import { lastNMonths, monthKey, monthRange, shiftMonth, toISODate } from '@/lib/date';
import { cashTotals } from '@/features/accounts/service';
import { portfolioSummary } from '@/features/investments/service';
import { computeFire, fireMilestones, type FireResult } from '@/features/fire/calc';
import { DEFAULT_FIRE_SETTINGS, type FireSettings } from '@/features/settings/schema';
import { runwayMonths, sipFutureValue } from '@/features/calculators/math';

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard(userId: string, month = monthKey()) {
  const prev = shiftMonth(month, -1);
  const { start, end } = monthRange(month);
  const { start: prevStart, end: prevEnd } = monthRange(prev);
  const trendMonths = lastNMonths(12, month);

  const [
    user,
    cash,
    portfolio,
    monthTotals,
    prevTotals,
    byCategory,
    trend,
    liabilities,
    upcoming,
    goals,
    budgetRows,
    needSplit,
    wasteCategories,
    needTrend,
    topMerchants,
    recentTx,
  ] = await Promise.all([
    one<{ name: string; currency: string; settings: FireSettings }>(
      `SELECT name, currency, settings FROM users WHERE id = $1`,
      [userId],
    ),
    cashTotals(userId),
    portfolioSummary(userId),
    monthAggregate(userId, start, end),
    monthAggregate(userId, prevStart, prevEnd),
    query<{ id: string; name: string; color: string; bucket: string; amount: number }>(
      `SELECT c.id, c.name, c.color, c.bucket, COALESCE(SUM(t.amount), 0) AS amount
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND t.type = 'expense' AND t.txn_date BETWEEN $2 AND $3
       GROUP BY c.id, c.name, c.color, c.bucket
       ORDER BY amount DESC`,
      [userId, start, end],
    ),
    query<{ month: string; income: number; expense: number; home: number; personal: number }>(
      `SELECT to_char(t.txn_date, 'YYYY-MM') AS month,
              COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense,
              COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.bucket = 'home'     THEN t.amount ELSE 0 END), 0) AS home,
              COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.bucket = 'personal' THEN t.amount ELSE 0 END), 0) AS personal
       FROM transactions t
       WHERE t.user_id = $1 AND t.txn_date >= $2 AND t.txn_date <= $3
       GROUP BY 1 ORDER BY 1`,
      [userId, monthRange(trendMonths[0]).start, end],
    ),
    one<{ outstanding: number; emi: number }>(
      `SELECT COALESCE(SUM(outstanding), 0) AS outstanding, COALESCE(SUM(emi), 0) AS emi
       FROM liabilities WHERE user_id = $1`,
      [userId],
    ),
    query(
      `SELECT r.*, c.name AS category_name, a.name AS account_name
       FROM recurring r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN accounts a ON a.id = r.account_id
       WHERE r.user_id = $1 AND r.active = true AND r.next_due <= $2
       ORDER BY r.next_due ASC LIMIT 8`,
      [userId, toISODate(new Date(Date.now() + 21 * 86_400_000))],
    ),
    query(`SELECT * FROM goals WHERE user_id = $1 ORDER BY target_date NULLS LAST, name`, [userId]),
    query<{
      category_id: string;
      name: string;
      color: string;
      bucket: string;
      amount: number;
      spent: number;
    }>(
      `SELECT b.category_id, c.name, c.color, c.bucket, b.amount,
              COALESCE((
                SELECT SUM(t.amount) FROM transactions t
                WHERE t.user_id = b.user_id AND t.category_id = b.category_id
                  AND t.type = 'expense' AND t.txn_date BETWEEN $2 AND $3
              ), 0) AS spent
       FROM budgets b JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = $1 AND b.month IN ('default', $4)
       ORDER BY spent DESC`,
      [userId, start, end, month],
    ),
    query<{ need_level: string; amount: number }>(
      `SELECT need_level, COALESCE(SUM(amount), 0) AS amount
       FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND txn_date BETWEEN $2 AND $3
       GROUP BY need_level`,
      [userId, start, end],
    ),
    query<{ name: string; color: string; amount: number; n: number }>(
      `SELECT COALESCE(c.name, 'Uncategorised') AS name,
              COALESCE(c.color, '#94A3B8')      AS color,
              SUM(t.amount) AS amount, COUNT(*)::int AS n
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND t.type = 'expense' AND t.need_level = 'waste'
         AND t.txn_date BETWEEN $2 AND $3
       GROUP BY 1, 2 ORDER BY amount DESC LIMIT 5`,
      [userId, start, end],
    ),
    query<{ month: string; waste: number; want: number; need: number }>(
      `SELECT to_char(txn_date, 'YYYY-MM') AS month,
              COALESCE(SUM(CASE WHEN need_level = 'waste' THEN amount ELSE 0 END), 0) AS waste,
              COALESCE(SUM(CASE WHEN need_level = 'want'  THEN amount ELSE 0 END), 0) AS want,
              COALESCE(SUM(CASE WHEN need_level = 'need'  THEN amount ELSE 0 END), 0) AS need
       FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND txn_date >= $2 AND txn_date <= $3
       GROUP BY 1 ORDER BY 1`,
      [userId, monthRange(trendMonths[0]).start, end],
    ),
    query<{ merchant: string; amount: number; n: number }>(
      `SELECT COALESCE(NULLIF(t.merchant, ''), 'Uncategorised') AS merchant,
              SUM(t.amount) AS amount, COUNT(*)::int AS n
       FROM transactions t
       WHERE t.user_id = $1 AND t.type = 'expense' AND t.txn_date BETWEEN $2 AND $3
       GROUP BY 1 ORDER BY amount DESC LIMIT 5`,
      [userId, start, end],
    ),
    query(
      `SELECT t.id, t.amount, t.type, t.bucket, t.need_level, t.txn_date, t.merchant, t.note,
              c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
              a.name AS account_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN accounts a ON a.id = t.account_id
       WHERE t.user_id = $1
       ORDER BY t.txn_date DESC, t.created_at DESC LIMIT 8`,
      [userId],
    ),
  ]);

  const settings = { ...DEFAULT_FIRE_SETTINGS, ...(user?.settings ?? {}) };
  const netWorth = cash.cash + portfolio.current - (liabilities?.outstanding ?? 0) - cash.cardDues;

  // Average real spend beats the typed-in guess once there is history.
  const spendingMonths = trend.filter((t) => t.expense > 0);
  const avgMonthlyExpense = spendingMonths.length
    ? spendingMonths.reduce((s, t) => s + t.expense, 0) / spendingMonths.length
    : settings.monthly_expenses;

  const fire: FireResult = computeFire({
    ...settings,
    monthly_expenses: settings.monthly_expenses || Math.round(avgMonthlyExpense),
    currentCorpus: portfolio.liquidCorpus + cash.emergency,
  });

  const emergencyTarget = (settings.monthly_expenses || avgMonthlyExpense) * settings.emergency_months;
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
    liabilities: (liabilities?.outstanding ?? 0) + cash.cardDues,
    netWorth,
  });

  const netWorthTrend = await query<{
    month: string;
    cash: number;
    investments: number;
    liabilities: number;
    net_worth: number;
  }>(
    `SELECT month, cash, investments, liabilities, net_worth
     FROM net_worth_snapshots WHERE user_id = $1 AND month >= $2 ORDER BY month`,
    [userId, trendMonths[0]],
  );

  const income = monthTotals.income;
  const expense = monthTotals.expense;

  // Cash flow, in the order a salaried person experiences it.
  const amountFor = (level: string) =>
    Number(needSplit.find((r) => r.need_level === level)?.amount ?? 0);
  const wasted = amountFor('waste');
  const wants = amountFor('want');
  const needs = amountFor('need');

  // What that wasted money would be worth if it were invested instead.
  const wasteIfInvested = {
    fiveYears: sipFutureValue(wasted, settings.pre_retirement_return, 5),
    tenYears: sipFutureValue(wasted, settings.pre_retirement_return, 10),
  };

  return {
    month,
    currency: user?.currency ?? 'INR',
    name: user?.name ?? 'You',
    settings,
    totals: {
      income,
      expense,
      net: income - expense,
      savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
      home: monthTotals.home,
      personal: monthTotals.personal,
      invested: monthTotals.invested,
      prevIncome: prevTotals.income,
      prevExpense: prevTotals.expense,
      avgMonthlyExpense,
    },
    cashflow: {
      salary: income,
      spent: expense,
      movedToSavings: monthTotals.invested,
      leftOver: income - expense - monthTotals.invested,
    },
    spendQuality: {
      needs,
      wants,
      wasted,
      wastedPct: expense > 0 ? (wasted / expense) * 100 : 0,
      categories: wasteCategories,
      ifInvested: wasteIfInvested,
      trend: trendMonths.map((m) => {
        const row = needTrend.find((t) => t.month === m);
        return {
          month: m,
          need: row?.need ?? 0,
          want: row?.want ?? 0,
          waste: row?.waste ?? 0,
        };
      }),
    },
    netWorth: {
      total: netWorth,
      cash: cash.cash,
      emergencyCash: cash.emergency,
      investments: portfolio.current,
      liabilities: (liabilities?.outstanding ?? 0) + cash.cardDues,
      emi: liabilities?.emi ?? 0,
    },
    portfolio,
    emergency,
    fire,
    milestones: fireMilestones(fire),
    trend: trendMonths.map((m) => {
      const row = trend.find((t) => t.month === m);
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
    byCategory,
    budgets: budgetRows,
    topMerchants,
    upcoming,
    goals,
    recentTx,
  };
}

async function monthAggregate(userId: string, start: string, end: string) {
  const row = await one<{
    income: number;
    expense: number;
    home: number;
    personal: number;
    invested: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
       COALESCE(SUM(CASE WHEN type = 'expense' AND bucket = 'home'     THEN amount ELSE 0 END), 0) AS home,
       COALESCE(SUM(CASE WHEN type = 'expense' AND bucket = 'personal' THEN amount ELSE 0 END), 0) AS personal,
       COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0) AS invested
     FROM transactions WHERE user_id = $1 AND txn_date BETWEEN $2 AND $3`,
    [userId, start, end],
  );
  return row ?? { income: 0, expense: 0, home: 0, personal: 0, invested: 0 };
}

/** Keeps a monthly net-worth history so the chart builds up over time. */
async function upsertSnapshot(
  userId: string,
  month: string,
  v: { cash: number; investments: number; liabilities: number; netWorth: number },
) {
  await query(
    `INSERT INTO net_worth_snapshots (user_id, month, cash, investments, liabilities, net_worth)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, month) DO UPDATE
       SET cash = EXCLUDED.cash,
           investments = EXCLUDED.investments,
           liabilities = EXCLUDED.liabilities,
           net_worth = EXCLUDED.net_worth`,
    [userId, month, v.cash, v.investments, v.liabilities, v.netWorth],
  );
}
