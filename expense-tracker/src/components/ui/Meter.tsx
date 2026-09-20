import { cn } from '@/lib/cn';

/**
 * A ratio against a limit - a meter, not a two-slice pie. The state is written
 * out in the caption, so the bar's colour is a reinforcement and never the
 * only signal.
 */
export function Meter({
  value,
  max,
  label,
  right,
  caption,
  tone = 'brand',
  className,
}: {
  value: number;
  max: number;
  label?: string;
  right?: string;
  caption?: string;
  tone?: 'brand' | 'good' | 'warn' | 'bad';
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = value > max && max > 0;
  const fill =
    tone === 'good'
      ? 'bg-good'
      : tone === 'warn'
        ? 'bg-warn'
        : tone === 'bad' || over
          ? 'bg-bad'
          : 'bg-brand';

  return (
    <div className={cn('w-full', className)}>
      {(label || right) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
          <span className="truncate font-medium text-ink">{label}</span>
          <span className="tnum shrink-0 text-ink-soft">{right}</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', fill)}
          style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}
        />
      </div>
      {caption ? <p className="mt-1.5 text-[12px] text-ink-muted">{caption}</p> : null}
    </div>
  );
}
