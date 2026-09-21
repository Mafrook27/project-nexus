'use client';

import { ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/lib/money';
import { monthKey, monthLabel } from '@/lib/date';
import { SERIES } from '@/lib/viz';
import { cn } from '@/lib/cn';

/**
 * The first thing a salaried person wants to know: what came in, what went
 * out, and what is left. Everything else on the dashboard is detail.
 */
export function CashFlowCard({
  month,
  cashflow,
  currency,
}: {
  month: string;
  cashflow: { salary: number; spent: number; movedToSavings: number; leftOver: number };
  currency: string;
}) {
  const { salary, spent, movedToSavings, leftOver } = cashflow;
  const kept = salary > 0 ? ((movedToSavings + leftOver) / salary) * 100 : 0;
  const total = Math.max(salary, spent + movedToSavings + Math.max(leftOver, 0)) || 1;

  const parts = [
    { label: 'Spent', value: spent, color: SERIES[1] },
    { label: 'Saved', value: movedToSavings, color: SERIES[2] },
    { label: 'Left over', value: Math.max(leftOver, 0), color: SERIES[0] },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">
          {month === monthKey() ? 'This month' : monthLabel(month, true)}
        </h2>
        <span className="text-[13px] text-ink-muted">
          You kept <span className="font-semibold text-ink">{kept.toFixed(0)}%</span> of what you
          earned
        </span>
      </div>

      <p className="num-mono mt-3 text-[34px] leading-none font-semibold text-ink sm:text-[40px]">
        {formatMoney(salary, currency)}
      </p>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">came in this month</p>

      <div className="mt-5 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-sunken">
        {parts.map((p) =>
          p.value > 0 ? (
            <div
              key={p.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
            />
          ) : null,
        )}
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <Figure
          label="Spent"
          value={formatMoney(spent, currency)}
          color={SERIES[1]}
          icon={<ArrowUpRight className="size-3.5" />}
        />
        <Figure
          label="Saved"
          value={formatMoney(movedToSavings, currency)}
          color={SERIES[2]}
          icon={<PiggyBank className="size-3.5" />}
        />
        <Figure
          label="Left over"
          value={formatMoney(leftOver, currency)}
          color={SERIES[0]}
          icon={leftOver >= 0 ? <Wallet className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
          warn={leftOver < 0}
        />
      </dl>

      {leftOver < 0 ? (
        <p className="mt-4 rounded-xl bg-bad-soft px-3 py-2.5 text-[13px] text-bad">
          You spent {formatMoney(Math.abs(leftOver), currency)} more than you earned this month.
        </p>
      ) : null}
    </Card>
  );
}

function Figure({
  label,
  value,
  color,
  icon,
  warn,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
        <span
          className="grid size-4 shrink-0 place-items-center rounded-[5px] text-white"
          style={{ background: color }}
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd
        className={cn(
          'num-mono mt-1 truncate text-[17px] font-semibold sm:text-[19px]',
          warn ? 'text-bad' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
