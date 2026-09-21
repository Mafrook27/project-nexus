'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/lib/money';
import { NEED_COLORS } from '@/lib/constants';

type SpendQuality = {
  needs: number;
  wants: number;
  wasted: number;
  wastedPct: number;
  categories: { name: string; color: string; amount: number; n: number }[];
  ifInvested: { fiveYears: number; tenYears: number };
};

/**
 * The money you would take back if you could. Marking a spend as wasted when
 * you record it is the whole input; this card is the payoff.
 */
export function LeaksCard({
  quality,
  currency,
}: {
  quality: SpendQuality;
  currency: string;
}) {
  const { needs, wants, wasted, wastedPct, categories, ifInvested } = quality;
  const total = needs + wants + wasted;
  const clean = wasted === 0 && total > 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Money you wasted</h2>
        <Link
          href="/transactions?need=waste"
          className="shrink-0 text-[12.5px] font-medium text-brand hover:underline"
        >
          See them
        </Link>
      </div>

      <p
        className="num-mono mt-3 text-[30px] leading-none font-semibold"
        style={{ color: wasted > 0 ? NEED_COLORS.waste : 'var(--color-good-ink)' }}
      >
        {formatMoney(wasted, currency)}
      </p>
      <p className="mt-1.5 text-[13px] text-ink-soft">
        {total === 0
          ? 'Nothing recorded yet this month.'
          : clean
            ? 'Nothing marked as wasted this month. Well done.'
            : `That is ${wastedPct.toFixed(0)}% of everything you spent.`}
      </p>

      {total > 0 ? (
        <div className="mt-5">
          <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-surface-sunken">
            {[
              { v: needs, c: NEED_COLORS.need },
              { v: wants, c: NEED_COLORS.want },
              { v: wasted, c: NEED_COLORS.waste },
            ].map((p, i) =>
              p.v > 0 ? (
                <div
                  key={i}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(p.v / total) * 100}%`, background: p.c }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 space-y-1.5">
            {[
              { label: 'Must have', value: needs, color: NEED_COLORS.need },
              { label: 'Nice to have', value: wants, color: NEED_COLORS.want },
              { label: 'Wasted', value: wasted, color: NEED_COLORS.waste },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-1.5 text-ink-soft">
                  <span
                    className="inline-block size-2.5 rounded-sm"
                    style={{ background: row.color }}
                  />
                  {row.label}
                </span>
                <span className="num-mono font-medium text-ink">
                  {formatMoney(row.value, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {categories.length ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <AlertTriangle className="size-3.5 text-bad" />
            Biggest leaks
          </p>
          <ul className="space-y-2">
            {categories.slice(0, 3).map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-ink-soft">
                  {c.name}
                  <span className="ml-1.5 text-[11.5px] text-ink-muted">
                    {c.n} time{c.n === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="num-mono shrink-0 font-medium text-ink">
                  {formatMoney(Number(c.amount), currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {wasted > 0 ? (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-[13px] text-brand-strong">
          <TrendingUp className="mt-0.5 size-4 shrink-0" />
          <span>
            Save this much every month instead and in 10 years it is{' '}
            <span className="font-semibold">{formatMoney(ifInvested.tenYears, currency)}</span>.
          </span>
        </p>
      ) : clean ? (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-good-soft px-3 py-2.5 text-[13px] text-good-ink">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>Every rupee this month went somewhere you meant it to go.</span>
        </p>
      ) : null}
    </Card>
  );
}
