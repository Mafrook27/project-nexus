'use client';

import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

export type RankedRow = { name: string; value: number; color: string; hint?: string };

/**
 * Magnitude, ranked high to low: a horizontal bar chart with the label and the
 * value written next to every bar. Long category names are the reason this is
 * horizontal rather than a column chart, and the reason it is not a pie.
 */
export function RankedBars({
  rows,
  currency,
  max,
  onSelect,
  className,
}: {
  rows: RankedRow[];
  currency: string;
  max?: number;
  onSelect?: (row: RankedRow) => void;
  className?: string;
}) {
  const ceiling = max ?? Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <ul className={cn('space-y-2.5', className)}>
      {rows.map((row) => {
        const pct = ceiling > 0 ? (row.value / ceiling) * 100 : 0;
        const share = total > 0 ? (row.value / total) * 100 : 0;
        const Tag = onSelect ? 'button' : 'div';
        return (
          <li key={row.name}>
            <Tag
              {...(onSelect ? { onClick: () => onSelect(row), type: 'button' as const } : {})}
              className={cn('block w-full text-left', onSelect && 'cursor-pointer')}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-medium text-ink">{row.name}</span>
                <span className="tnum shrink-0 text-[13px] text-ink-soft">
                  {formatMoney(row.value, currency)}
                  <span className="ml-1.5 text-[11.5px] text-ink-muted">{share.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-[4px] bg-surface-sunken">
                <div
                  className="h-full rounded-[4px] transition-[width] duration-500"
                  style={{ width: `${Math.max(pct, row.value > 0 ? 1.5 : 0)}%`, background: row.color }}
                />
              </div>
              {row.hint ? <p className="mt-1 text-[11.5px] text-ink-muted">{row.hint}</p> : null}
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}
