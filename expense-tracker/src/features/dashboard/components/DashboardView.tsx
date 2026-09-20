'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Landmark,
  PiggyBank,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Meter } from '@/components/ui/Meter';
import { Badge, Dot } from '@/components/ui/Badge';
import { EmptyState, ErrorNote, LoadingCard } from '@/components/ui/States';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { Button } from '@/components/ui/Button';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { TrendChart, TREND_LEGEND } from '@/components/charts/TrendChart';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { RankedBars } from '@/components/charts/RankedBars';
import { ShareBar } from '@/components/charts/ShareBar';
import { Td, TableWrap, Th } from '@/components/ui/Table';
import { useResource } from '@/hooks/useResource';
import { withQuery } from '@/lib/api';
import { compactMoney, formatMoney, pctChange } from '@/lib/money';
import { formatDateShort, monthKey, monthLabel } from '@/lib/date';
import { SERIES, foldTail } from '@/lib/viz';
import { FireCard } from './FireCard';
import type { DashboardData } from '../service';

export function DashboardView() {
  const [month, setMonth] = useState(monthKey());
  const { data, error, loading, reload } = useResource<DashboardData>(
    withQuery('/api/dashboard', { month }),
  );

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <LoadingCard key={i} height="h-28" />
          ))}
        </div>
        <LoadingCard height="h-72" />
      </div>
    );
  }
  if (!data) return null;

  const { currency, totals, netWorth, fire, emergency, portfolio } = data;
  const categoryRows = foldTail(
    data.byCategory.map((c) => ({ name: c.name, value: Number(c.amount) })),
  );
  const overBudget = data.budgets.filter((b) => Number(b.spent) > Number(b.amount));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Hello, {data.name.split(' ')[0]}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Here is where your money stands for {monthLabel(month, true)}.
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </header>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Net worth"
          value={formatMoney(netWorth.total, currency)}
          sub={`${compactMoney(netWorth.cash, currency)} cash · ${compactMoney(netWorth.investments, currency)} invested`}
          icon={<Wallet className="size-4" />}
          accent={SERIES[0]}
        />
        <StatTile
          label="Spent this month"
          value={formatMoney(totals.expense, currency)}
          delta={pctChange(totals.expense, totals.prevExpense)}
          deltaGoodWhen="down"
          sub="vs last month"
          icon={<TrendingDown className="size-4" />}
          accent={SERIES[1]}
        />
        <StatTile
          label="Income"
          value={formatMoney(totals.income, currency)}
          delta={pctChange(totals.income, totals.prevIncome)}
          sub="vs last month"
          icon={<TrendingUp className="size-4" />}
          accent={SERIES[2]}
        />
        <StatTile
          label="Savings rate"
          value={`${totals.savingsRate.toFixed(0)}%`}
          sub={`${formatMoney(totals.net, currency)} left over`}
          icon={<PiggyBank className="size-4" />}
          accent={SERIES[6]}
        />
      </div>

      {/* Cash flow + split */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Income vs spending"
          subtitle="Last 12 months"
          legend={TREND_LEGEND}
          className="lg:col-span-2"
          height="h-[280px]"
          table={
            <TableWrap>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th align="right">Income</Th>
                  <Th align="right">Spending</Th>
                  <Th align="right">Saved</Th>
                </tr>
              </thead>
              <tbody>
                {data.trend.map((t) => (
                  <tr key={t.month}>
                    <Td>{monthLabel(t.month, true)}</Td>
                    <Td align="right">{formatMoney(t.income, currency)}</Td>
                    <Td align="right">{formatMoney(t.expense, currency)}</Td>
                    <Td align="right">{formatMoney(t.net, currency)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          }
        >
          <TrendChart data={data.trend} currency={currency} />
        </ChartFrame>

        <Card>
          <CardHeader
            title="Home vs personal"
            subtitle={`${formatMoney(totals.expense, currency)} spent in ${monthLabel(month)}`}
          />
          <ShareBar
            currency={currency}
            parts={[
              { label: 'Home', value: totals.home, color: SERIES[0] },
              { label: 'Personal', value: totals.personal, color: SERIES[1] },
            ]}
          />
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 text-[13px] font-medium text-ink">Top merchants</p>
            {data.topMerchants.length ? (
              <ul className="space-y-2">
                {data.topMerchants.map((m) => (
                  <li key={m.merchant} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-ink-soft">{m.merchant}</span>
                    <span className="tnum shrink-0 font-medium">
                      {formatMoney(Number(m.amount), currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-muted">Nothing recorded yet this month.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Where it went */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Where the money went"
          subtitle={monthLabel(month, true)}
          className="lg:col-span-2"
          height="h-auto"
          action={
            <Link
              href="/transactions"
              className="text-[12.5px] font-medium text-brand hover:underline"
            >
              All transactions
            </Link>
          }
        >
          {categoryRows.length ? (
            <RankedBars rows={categoryRows} currency={currency} />
          ) : (
            <EmptyState
              title="No spending recorded"
              description="Add your first transaction and this fills in automatically."
            />
          )}
        </ChartFrame>

        <FireCard fire={fire} milestones={data.milestones} currency={currency} />
      </div>

      {/* Safety + upcoming */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Emergency fund"
            subtitle={`Target ${emergency.targetMonths} months of expenses`}
            action={<ShieldCheck className="size-4.5 text-ink-muted" />}
          />
          <p className="tnum text-[26px] leading-none font-semibold text-ink">
            {formatMoney(emergency.saved, currency)}
          </p>
          <Meter
            value={emergency.saved}
            max={emergency.target}
            tone={emergency.pct >= 100 ? 'good' : emergency.pct >= 50 ? 'brand' : 'warn'}
            className="mt-4"
            caption={
              emergency.saved <= 0
                ? 'Mark one of your accounts as the emergency fund to start tracking this.'
                : `Covers ${emergency.months.toFixed(1)} months of spending — target is ${emergency.targetMonths}.`
            }
          />
          <Link
            href="/accounts"
            className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline"
          >
            Manage accounts <ArrowRight className="size-3.5" />
          </Link>
        </Card>

        <Card>
          <CardHeader
            title="Budgets"
            subtitle={overBudget.length ? `${overBudget.length} over limit` : 'All within limit'}
            action={
              <Link href="/budgets" className="text-[12.5px] font-medium text-brand hover:underline">
                Edit
              </Link>
            }
          />
          {data.budgets.length ? (
            <ul className="space-y-3.5">
              {data.budgets.slice(0, 5).map((b) => (
                <li key={b.category_id}>
                  <Meter
                    label={b.name}
                    value={Number(b.spent)}
                    max={Number(b.amount)}
                    right={`${formatMoney(Number(b.spent), currency)} / ${formatMoney(Number(b.amount), currency)}`}
                    tone={Number(b.spent) > Number(b.amount) ? 'bad' : 'brand'}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No budgets yet"
              description="Set a monthly cap per category to catch overspending early."
              action={
                <Link href="/budgets">
                  <Button size="sm" variant="secondary">
                    Set a budget
                  </Button>
                </Link>
              }
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Due soon"
            subtitle="Next 3 weeks"
            action={<CalendarClock className="size-4.5 text-ink-muted" />}
          />
          {data.upcoming.length ? (
            <ul className="space-y-2.5">
              {data.upcoming.map((r) => {
                const bill = r as Record<string, string | number>;
                return (
                  <li
                    key={String(bill.id)}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {String(bill.name)}
                      </span>
                      <span className="text-[12px] text-ink-muted">
                        {formatDateShort(String(bill.next_due))}
                        {bill.category_name ? ` · ${bill.category_name}` : ''}
                      </span>
                    </span>
                    <span className="tnum shrink-0 font-medium">
                      {formatMoney(Number(bill.amount), currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Nothing due"
              description="Recurring rent, EMIs and subscriptions show up here."
              action={
                <Link href="/bills">
                  <Button size="sm" variant="secondary">
                    Add a bill
                  </Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>

      {/* Wealth */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Net worth over time"
          subtitle="Recorded at the end of each month you use the app"
          className="lg:col-span-2"
          height={data.netWorthTrend.length > 1 ? 'h-[240px]' : 'h-auto'}
        >
          {data.netWorthTrend.length > 1 ? (
            <AreaTrend
              data={data.netWorthTrend as unknown as Record<string, unknown>[]}
              dataKey="net_worth"
              name="Net worth"
              currency={currency}
            />
          ) : (
            <EmptyState
              title="Building your history"
              description="A point is saved each month you open the dashboard, so this chart fills in as you go."
            />
          )}
        </ChartFrame>

        <Card>
          <CardHeader
            title="Portfolio by person"
            subtitle={`${formatMoney(portfolio.current, currency)} total`}
            action={
              <Link
                href="/investments"
                className="text-[12.5px] font-medium text-brand hover:underline"
              >
                Open
              </Link>
            }
          />
          {portfolio.byPerson.length ? (
            <>
              <ShareBar
                currency={currency}
                parts={portfolio.byPerson.slice(0, 5).map((p, i) => ({
                  label: p.name,
                  value: Number(p.current),
                  color: SERIES[i],
                }))}
              />
              <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-soft">
                Gains so far{' '}
                <span
                  className={
                    portfolio.gain >= 0 ? 'font-medium text-good-ink' : 'font-medium text-bad'
                  }
                >
                  {portfolio.gain >= 0 ? '+' : ''}
                  {formatMoney(portfolio.gain, currency)} ({portfolio.gainPct.toFixed(1)}%)
                </span>
              </p>
            </>
          ) : (
            <EmptyState
              icon={<Landmark className="size-5" />}
              title="No investments yet"
              description="Add mutual funds, stocks, FDs or PPF — yours, your mother's and your father's."
              action={
                <Link href="/investments">
                  <Button size="sm" variant="secondary">
                    Add investment
                  </Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>

      {/* Recent */}
      <Card>
        <CardHeader
          title="Recent activity"
          action={
            <Link
              href="/transactions"
              className="text-[12.5px] font-medium text-brand hover:underline"
            >
              See all
            </Link>
          }
        />
        {data.recentTx.length ? (
          <ul className="divide-y divide-line">
            {data.recentTx.map((t) => {
              const tx = t as Record<string, string | number>;
              const isIncome = tx.type === 'income';
              return (
                <li key={String(tx.id)} className="flex items-center gap-3 py-2.5">
                  <Dot color={String(tx.category_color ?? '')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">
                      {String(tx.merchant || tx.category_name || 'Transaction')}
                    </p>
                    <p className="truncate text-[12px] text-ink-muted">
                      {formatDateShort(String(tx.txn_date))}
                      {tx.account_name ? ` · ${tx.account_name}` : ''}
                    </p>
                  </div>
                  <Badge tone={tx.bucket === 'home' ? 'neutral' : 'neutral'}>
                    {tx.bucket === 'home' ? 'Home' : 'Personal'}
                  </Badge>
                  <span
                    className={`tnum shrink-0 text-[13.5px] font-semibold ${
                      isIncome ? 'text-good-ink' : 'text-ink'
                    }`}
                  >
                    {isIncome ? '+' : '−'}
                    {formatMoney(Number(tx.amount), currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Nothing recorded yet"
            description="Use the Add button to record your first expense."
          />
        )}
      </Card>
    </div>
  );
}
