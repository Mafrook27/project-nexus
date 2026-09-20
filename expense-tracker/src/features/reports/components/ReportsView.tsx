'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { TableWrap, Td, Th } from '@/components/ui/Table';
import { ErrorNote, LoadingCard, EmptyState } from '@/components/ui/States';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { TrendChart, TREND_LEGEND } from '@/components/charts/TrendChart';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { RankedBars } from '@/components/charts/RankedBars';
import { ShareBar } from '@/components/charts/ShareBar';
import { useResource } from '@/hooks/useResource';
import { withQuery } from '@/lib/api';
import { formatMoney, pctChange } from '@/lib/money';
import { monthKey, monthLabel } from '@/lib/date';
import { SERIES, foldTail } from '@/lib/viz';
import type { DashboardData } from '@/features/dashboard/service';

/** The read-only analysis view: twelve months of behaviour, in one place. */
export function ReportsView() {
  const [month, setMonth] = useState(monthKey());
  const { data, error, loading, reload } = useResource<DashboardData>(
    withQuery('/api/dashboard', { month }),
  );

  const yearly = useMemo(() => {
    if (!data) return null;
    const income = data.trend.reduce((s, t) => s + t.income, 0);
    const expense = data.trend.reduce((s, t) => s + t.expense, 0);
    const home = data.trend.reduce((s, t) => s + t.home, 0);
    const personal = data.trend.reduce((s, t) => s + t.personal, 0);
    const months = data.trend.filter((t) => t.expense > 0).length || 1;
    return {
      income,
      expense,
      home,
      personal,
      saved: income - expense,
      savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
      avgExpense: expense / months,
      best: [...data.trend].sort((a, b) => b.net - a.net)[0],
      worst: [...data.trend].filter((t) => t.expense > 0).sort((a, b) => b.expense - a.expense)[0],
    };
  }, [data]);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data) return <LoadingCard height="h-96" />;
  if (!data || !yearly) return null;

  const { currency } = data;
  const savingsSeries = data.trend.map((t) => ({
    month: t.month,
    rate: t.income > 0 ? Math.round(((t.income - t.expense) / t.income) * 100) : 0,
  }));
  const categoryRows = foldTail(
    data.byCategory.map((c) => ({ name: c.name, value: Number(c.amount) })),
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Reports</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            The last twelve months of your money, read back to you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} />
          <a href="/api/export?type=transactions" download>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> Export CSV
            </Button>
          </a>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Income (12 mo)" value={formatMoney(yearly.income, currency)} accent={SERIES[0]} />
        <StatTile label="Spending (12 mo)" value={formatMoney(yearly.expense, currency)} accent={SERIES[1]} />
        <StatTile
          label="Saved"
          value={formatMoney(yearly.saved, currency)}
          sub={`${yearly.savingsRate.toFixed(0)}% savings rate`}
          accent={SERIES[2]}
        />
        <StatTile
          label="Average month"
          value={formatMoney(yearly.avgExpense, currency)}
          sub="Spending, across active months"
        />
      </div>

      <ChartFrame
        title="Income against spending"
        subtitle="Twelve months"
        legend={TREND_LEGEND}
        height="h-[300px]"
        table={
          <TableWrap>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th align="right">Income</Th>
                <Th align="right">Spending</Th>
                <Th align="right">Home</Th>
                <Th align="right">Personal</Th>
                <Th align="right">Saved</Th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((t) => (
                <tr key={t.month}>
                  <Td>{monthLabel(t.month, true)}</Td>
                  <Td align="right">{formatMoney(t.income, currency)}</Td>
                  <Td align="right">{formatMoney(t.expense, currency)}</Td>
                  <Td align="right">{formatMoney(t.home, currency)}</Td>
                  <Td align="right">{formatMoney(t.personal, currency)}</Td>
                  <Td align="right">{formatMoney(t.net, currency)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        }
      >
        <TrendChart data={data.trend} currency={currency} />
      </ChartFrame>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Savings rate"
          subtitle="Share of income you kept, month by month"
          height="h-[240px]"
        >
          <AreaTrend
            data={savingsSeries as unknown as Record<string, unknown>[]}
            dataKey="rate"
            name="Savings rate"
            currency={currency}
            color={SERIES[2]}
            unit="percent"
          />
        </ChartFrame>

        <Card>
          <CardHeader
            title="Home against personal"
            subtitle="Twelve-month totals"
          />
          <ShareBar
            currency={currency}
            parts={[
              { label: 'Home', value: yearly.home, color: SERIES[0] },
              { label: 'Personal', value: yearly.personal, color: SERIES[1] },
            ]}
          />
          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Best saving month</dt>
              <dd className="tnum font-medium">
                {yearly.best ? `${monthLabel(yearly.best.month, true)} · ${formatMoney(yearly.best.net, currency)}` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Heaviest spending month</dt>
              <dd className="tnum font-medium">
                {yearly.worst
                  ? `${monthLabel(yearly.worst.month, true)} · ${formatMoney(yearly.worst.expense, currency)}`
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">This month against last</dt>
              <dd className="tnum font-medium">
                {(() => {
                  const change = pctChange(data.totals.expense, data.totals.prevExpense);
                  if (change === null) return '—';
                  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
                })()}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ChartFrame
          title={`Categories in ${monthLabel(month, true)}`}
          subtitle="Ranked by amount"
          height="h-auto"
        >
          {categoryRows.length ? (
            <RankedBars rows={categoryRows} currency={currency} />
          ) : (
            <EmptyState title="No spending this month" />
          )}
        </ChartFrame>

        <Card>
          <CardHeader title="Where it went" subtitle="Every category, with its share" />
          {data.byCategory.length ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th>Bucket</Th>
                  <Th align="right">Amount</Th>
                  <Th align="right">Share</Th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: c.color }}
                        />
                        {c.name}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[13px] text-ink-soft">
                        {c.bucket === 'home' ? 'Home' : 'Personal'}
                      </span>
                    </Td>
                    <Td align="right">{formatMoney(Number(c.amount), currency)}</Td>
                    <Td align="right">
                      {data.totals.expense > 0
                        ? `${((Number(c.amount) / data.totals.expense) * 100).toFixed(1)}%`
                        : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="Nothing to report yet" />
          )}
        </Card>
      </div>

      <ChartFrame
        title="Net worth"
        subtitle="Cash plus investments, minus debt"
        height={data.netWorthTrend.length > 1 ? 'h-[260px]' : 'h-auto'}
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
            title="Not enough history yet"
            description="One point is recorded each month you use the app."
          />
        )}
      </ChartFrame>
    </div>
  );
}
