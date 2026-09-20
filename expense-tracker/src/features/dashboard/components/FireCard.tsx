'use client';

import Link from 'next/link';
import { Check, Flame, Lock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Meter';
import { compactMoney, formatMoney } from '@/lib/money';
import type { FireResult } from '@/features/fire/calc';

type Milestone = { label: string; target: number; reached: boolean; pct: number };

/**
 * The headline of the whole app: one hero number, one meter, and the milestone
 * ladder underneath. Status is written in words, never colour alone.
 */
export function FireCard({
  fire,
  milestones,
  currency,
}: {
  fire: FireResult;
  milestones: Milestone[];
  currency: string;
}) {
  const yearsLeft = fire.monthsToFi !== null ? fire.monthsToFi / 12 : null;

  return (
    <Card className="flex flex-col">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            <Flame className="size-4 text-brand" />
            Financial independence
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Corpus that funds {formatMoney(fire.annualExpensesToday / 12, currency)} a month, forever
          </p>
        </div>
        <Link
          href="/fire"
          className="shrink-0 text-[12.5px] font-medium text-brand hover:underline"
        >
          Details
        </Link>
      </header>

      <p className="tnum text-[34px] leading-none font-semibold text-ink">
        {fire.progressPct.toFixed(1)}%
      </p>
      <p className="mt-1.5 text-[13px] text-ink-soft">
        {formatMoney(fire.currentCorpus, currency)} of{' '}
        <span className="font-medium">{formatMoney(fire.fiNumberToday, currency)}</span>
      </p>

      <Meter
        value={fire.currentCorpus}
        max={fire.fiNumberToday}
        tone={fire.achieved ? 'good' : 'brand'}
        className="mt-4"
        caption={
          fire.achieved
            ? 'Goal reached — your corpus already covers your expenses.'
            : yearsLeft === null
              ? 'Add a monthly investment amount in Settings to see a target date.'
              : `On the current plan you get there in about ${yearsLeft.toFixed(1)} years, around age ${Math.round(fire.fiAge ?? 0)}.`
        }
      />

      <ul className="mt-5 space-y-2 border-t border-line pt-4">
        {milestones.map((m) => (
          <li key={m.label} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={
                m.reached
                  ? 'grid size-5 shrink-0 place-items-center rounded-full bg-good-soft text-good-ink'
                  : 'grid size-5 shrink-0 place-items-center rounded-full bg-surface-sunken text-ink-muted'
              }
            >
              {m.reached ? <Check className="size-3" /> : <Lock className="size-2.5" />}
            </span>
            <span className={m.reached ? 'font-medium text-ink' : 'text-ink-soft'}>{m.label}</span>
            <span className="tnum ml-auto text-ink-muted">{compactMoney(m.target, currency)}</span>
            <span className="tnum w-10 text-right text-[12px] text-ink-muted">
              {m.pct.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
