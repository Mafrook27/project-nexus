'use client';

import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

export type Share = { label: string; value: number; color: string };

/**
 * Part-to-whole for a small number of parts: one stacked horizontal bar with a
 * 2px surface gap between segments, plus a written-out legend underneath.
 */
export function ShareBar({
  parts,
  currency,
  className,
}: {
  parts: Share[];
  currency: string;
  className?: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);

  return (
    <div className={className}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-sunken">
        {total > 0 ? (
          parts.map((p) => (
            <div
              key={p.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
              title={`${p.label}: ${formatMoney(p.value, currency)}`}
            />
          ))
        ) : null}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm ring-2 ring-surface"
                style={{ background: p.color }}
              />
              <span className="truncate">{p.label}</span>
            </span>
            <span className={cn('tnum shrink-0 font-medium text-ink')}>
              {formatMoney(p.value, currency)}
              <span className="ml-1.5 text-[11.5px] font-normal text-ink-muted">
                {total > 0 ? `${((p.value / total) * 100).toFixed(0)}%` : '0%'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
