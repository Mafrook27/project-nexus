'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CalendarClock, Landmark, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
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
import { CashFlowCard } from './CashFlowCard';
import { LeaksCard } from './LeaksCard';
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
        <LoadingCard height="h-56" />
        <div className="grid gap-4 lg:grid-cols-2">
          <LoadingCard height="h-72" />
          <LoadingCard height="h-72" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { currency, totals, netWorth, fire, emergency, portfolio, spendQuality } = data;
  const categoryRows = foldTail(
    data.byCategory.map((c) => ({ name: c.name, value: Number(c.amount) })),
  );
  const overBudget = data.budgets.filter((b) => Number(b.spent) > Number(b.amount));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Hi, {data.name.split(' ')[0]}
        </h1>
        <MonthPicker value={month} onChange={setMonth} />
      </header>

      {/* What happened to this month's salary, and what of it was wasted. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <CashFlowCard month={month} cashflow={data.cashflow} currency={currency} />
        <LeaksCard quality={spendQuality} currency={currency} />
      </div>

      {/* The four numbers worth glancing at. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Spent this month"
          value={formatMoney(totals.expense, currency)}
          delta={pctChange(totals.expense, totals.prevExpense)}
          deltaGoodWhen="down"
          sub="vs last month"
          accent={SERIES[1]}
        />
        <StatTile
          label="Total savings"
          value={formatMoney(netWorth.cash, currency)}
          sub="In your bank and cash"
          icon={<Wallet className="size-4" />}
          accent={SERIES[0]}
        />
        <StatTile
          label="Investments"
          value={formatMoney(netWorth.investments, currency)}
          delta={portfolio.invested > 0 ? portfolio.gainPct : null}
          sub="since you started"
          icon={<TrendingUp className="size-4" />}
          accent={SERIES[2]}
        />
        <StatTile
          label="Net worth"
          value={formatMoney(netWorth.total, currency)}
          sub={netWorth.liabilities > 0 ? `after ${compactMoney(netWorth.liabilities, currency)} of debt` : 'No debt'}
          accent={SERIES[6]}
        />
      </div>

      {/* Where it went. */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <ChartFrame
          title="Where your money went"
          className="lg:col-span-2"
          height="h-auto"
          action={
            <Link
              href="/transactions"
              className="text-[12.5px] font-medium text-brand hover:underline"
            >
              See all
            </Link>
          }
        >
          {categoryRows.length ? (
            <RankedBars rows={categoryRows} currency={currency} />
          ) : (
            <EmptyState
              title="Nothing recorded yet"
              description="Add your first spend and this fills in on its own."
            />
          )}
        </ChartFrame>

        <Card>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">Home vs personal</h2>
            <span className="num-mono text-[13px] text-ink-muted">
              {formatMoney(totals.expense, currency)}
            </span>
          </div>
          <ShareBar
            currency={currency}
            parts={[
              { label: 'Home', value: totals.home, color: SERIES[0] },
              { label: 'Personal', value: totals.personal, color: SERIES[1] },
            ]}
          />
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 text-[13px] font-medium text-ink">You paid the most to</p>
            {data.topMerchants.length ? (
              <ul className="space-y-2">
                {data.topMerchants.map((m) => (
                  <li
                    key={m.merchant}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span className="truncate text-ink-soft">{m.merchant}</span>
                    <span className="num-mono shrink-0 font-medium">
                      {formatMoney(Number(m.amount), currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-muted">Nothing yet this month.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Money in against money out, over the year. */}
      <ChartFrame
        title="Earning against spending"
        legend={TREND_LEGEND}
        height="h-[280px]"
        table={
          <TableWrap>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th align="right">Came in</Th>
                <Th align="right">Went out</Th>
                <Th align="right">Kept</Th>
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

      {/* Safety nets and what is due. */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">Emergency fund</h2>
            <ShieldCheck className="size-4.5 shrink-0 text-ink-muted" />
          </div>
          <p className="num-mono text-[26px] leading-none font-semibold text-ink">
            {formatMoney(emergency.saved, currency)}
          </p>
          <Meter
            value={emergency.saved}
            max={emergency.target}
            tone={emergency.pct >= 100 ? 'good' : emergency.pct >= 50 ? 'brand' : 'warn'}
            className="mt-4"
            caption={
              emergency.saved <= 0
                ? 'Tick one account as your emergency fund to start this.'
                : `Enough for ${emergency.months.toFixed(1)} months. Aim for ${emergency.targetMonths}.`
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
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">
              Budgets
              {overBudget.length ? (
                <Badge tone="bad" className="ml-2">
                  {overBudget.length} over
                </Badge>
              ) : null}
            </h2>
            <Link href="/budgets" className="text-[12.5px] font-medium text-brand hover:underline">
              Edit
            </Link>
          </div>
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
              title="No limits set"
              description="Give a category a monthly limit and you will know before you overspend."
              action={
                <Link href="/budgets">
                  <Button size="sm" variant="secondary">
                    Set a limit
                  </Button>
                </Link>
              }
            />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">Coming up</h2>
            <CalendarClock className="size-4.5 shrink-0 text-ink-muted" />
          </div>
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
                      </span>
                    </span>
                    <span className="num-mono shrink-0 font-medium">
                      {formatMoney(Number(bill.amount), currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Nothing due"
              description="Add rent, EMIs and subscriptions so none of them surprise you."
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

      {/* The long game. */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <FireCard fire={fire} milestones={data.milestones} currency={currency} />

        <ChartFrame
          title="Net worth over time"
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
              title="This chart needs a few months"
              description="One point is saved every month you open the app, so it fills in as you go."
            />
          )}
        </ChartFrame>
      </div>

      {/* Family money, kept out of the way until you want it. */}
      {portfolio.byPerson.length ? (
        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">Whose money is invested</h2>
            <Link
              href="/investments"
              className="text-[12.5px] font-medium text-brand hover:underline"
            >
              Open
            </Link>
          </div>
          <ShareBar
            currency={currency}
            parts={portfolio.byPerson.slice(0, 5).map((p, i) => ({
              label: p.name,
              value: Number(p.current),
              color: SERIES[i],
            }))}
          />
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<Landmark className="size-5" />}
            title="No investments added"
            description="Add mutual funds, stocks or FDs. You can tag your parents' ones too."
            action={
              <Link href="/investments">
                <Button size="sm" variant="secondary">
                  Add investment
                </Button>
              </Link>
            }
          />
        </Card>
      )}

      {/* Latest entries. */}
      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">Latest</h2>
          <Link
            href="/transactions"
            className="text-[12.5px] font-medium text-brand hover:underline"
          >
            See all
          </Link>
        </div>
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
                  {tx.need_level === 'waste' ? <Badge tone="bad">Wasted</Badge> : null}
                  <span
                    className={`num-mono shrink-0 text-[13.5px] font-semibold ${
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
            description="Tap Add to record your first spend."
          />
        )}
      </Card>
    </div>
  );
}
