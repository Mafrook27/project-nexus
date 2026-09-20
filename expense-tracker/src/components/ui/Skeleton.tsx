import { cn } from '@/lib/cn';

/**
 * Loading placeholders that trace the shape of the real content: a stat tile
 * skeleton is tile-sized, a chart skeleton has an axis and bars. The page
 * therefore never jumps when the data arrives, and you can tell what is coming
 * before it gets there - which a spinner never tells you.
 *
 * Every block here is decorative, so it is hidden from screen readers and the
 * surrounding region carries `aria-busy` instead.
 */

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton block', className)} />;
}

/** A run of text lines, the last one short like a real paragraph. */
export function SkeletonText({
  lines = 2,
  className,
  width = 'w-full',
}: {
  lines?: number;
  className?: string;
  width?: string;
}) {
  return (
    <div aria-hidden className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3 rounded-md', i === lines - 1 ? 'w-2/3' : width)}
        />
      ))}
    </div>
  );
}

/** The card chrome, so skeletons sit on the same surface as the real cards. */
export function SkeletonCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5',
        className,
      )}
    >
      <span className="sr-only">Loading</span>
      {children}
    </section>
  );
}

export function SkeletonHeader({ action = true }: { action?: boolean }) {
  return (
    <div aria-hidden className="mb-4 flex items-start justify-between gap-3">
      <Skeleton className="h-4 w-36 rounded-md" />
      {action ? <Skeleton className="h-4 w-14 rounded-md" /> : null}
    </div>
  );
}

/** Matches StatTile: label, big figure, small caption. */
export function SkeletonStat() {
  return (
    <div
      aria-busy="true"
      className="rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] sm:p-4"
    >
      <Skeleton className="h-2.5 w-20 rounded" />
      <Skeleton className="mt-3 h-7 w-28 rounded-md sm:h-8" />
      <Skeleton className="mt-2.5 h-2.5 w-24 rounded" />
    </div>
  );
}

export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

/** A line chart's silhouette: y-axis ticks, gridlines, a curve, x-axis labels. */
export function SkeletonChart({ height = 'h-[280px]' }: { height?: string }) {
  return (
    <div aria-hidden className={cn('flex w-full gap-3', height)}>
      <div className="flex w-12 shrink-0 flex-col justify-between py-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-2.5 w-full rounded" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute inset-x-0 h-px bg-line"
              style={{ top: `${i * 27 + 6}%` }}
            />
          ))}
          <div className="absolute inset-x-0 bottom-[18%] h-10">
            <Skeleton className="h-full w-full rounded-lg opacity-70" />
          </div>
          <div className="absolute inset-x-0 bottom-[42%] h-6">
            <Skeleton className="h-full w-full rounded-lg opacity-45" />
          </div>
        </div>
        <div className="mt-3 flex justify-between">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-2.5 w-8 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Matches RankedBars: a label and amount above each bar. */
export function SkeletonBars({ rows = 7 }: { rows?: number }) {
  const widths = ['w-full', 'w-4/5', 'w-3/5', 'w-1/2', 'w-2/5', 'w-1/3', 'w-1/4', 'w-1/5'];
  return (
    <ul aria-hidden className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-[4px] bg-surface-sunken">
            <Skeleton className={cn('h-full rounded-[4px]', widths[i % widths.length])} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Matches a transaction row: dot, two lines, badge, amount. */
export function SkeletonRows({ rows = 8, divided = true }: { rows?: number; divided?: boolean }) {
  return (
    <ul aria-hidden className={cn(divided && 'divide-y divide-line')}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className={cn('h-3.5 rounded', i % 3 === 0 ? 'w-40' : 'w-28')} />
            <Skeleton className="h-2.5 w-48 rounded" />
          </div>
          <Skeleton className="hidden h-5 w-16 shrink-0 rounded-md sm:block" />
          <Skeleton className="h-3.5 w-20 shrink-0 rounded" />
        </li>
      ))}
    </ul>
  );
}

/** Matches a Meter: label, value, track. */
export function SkeletonMeters({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-hidden className="space-y-3.5">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div aria-hidden className="w-full">
      <div className="flex gap-4 border-b border-line pb-2">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className={cn('h-2.5 rounded', i === 0 ? 'w-32 flex-1' : 'w-16')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line py-3">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton
              key={c}
              className={cn('h-3 rounded', c === 0 ? 'w-32 flex-1' : 'w-16')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The page title row, so navigation does not shift the header. */
export function SkeletonPageHeader({ action = true }: { action?: boolean }) {
  return (
    <div aria-hidden className="flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-7 w-48 rounded-lg" />
      {action ? <Skeleton className="h-9 w-36 rounded-xl" /> : null}
    </div>
  );
}

export function SkeletonSliders({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
