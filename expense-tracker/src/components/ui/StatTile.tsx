import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * A single number is a stat tile, never a one-bar chart. Delta is shown with an
 * arrow *and* a sign so colour never carries the meaning on its own.
 */
export function StatTile({
  label,
  value,
  sub,
  delta,
  deltaGoodWhen = 'up',
  icon,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: number | null;
  deltaGoodWhen?: 'up' | 'down';
  icon?: ReactNode;
  accent?: string;
  className?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const up = hasDelta && (delta as number) >= 0;
  const good = hasDelta && (deltaGoodWhen === 'up' ? up : !up);

  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] sm:p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] font-medium tracking-wide text-ink-muted uppercase sm:text-[12.5px]">
          {label}
        </span>
        {icon ? (
          <span
            className="hidden size-7 place-items-center rounded-lg sm:grid"
            style={{ background: accent ? `${accent}18` : 'var(--color-surface-sunken)', color: accent ?? 'var(--color-ink-muted)' }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="num-mono mt-2 text-[21px] leading-tight font-semibold text-ink sm:text-[26px]">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium num-mono',
              good ? 'bg-good-soft text-good-ink' : 'bg-bad-soft text-bad',
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {up ? '+' : ''}
            {(delta as number).toFixed(1)}%
          </span>
        ) : null}
        {sub ? <span className="text-[12.5px] text-ink-muted">{sub}</span> : null}
      </div>
    </div>
  );
}
