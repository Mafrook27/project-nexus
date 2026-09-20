import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon ? (
        <span className="mb-3 grid size-11 place-items-center rounded-xl bg-surface-sunken text-ink-muted">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-sunken', className)} />;
}

export function LoadingCard({ height = 'h-64' }: { height?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]',
        height,
      )}
    />
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-bad/25 bg-bad-soft px-4 py-3 text-[13px] text-bad">
      <p className="font-medium">Could not load this</p>
      <p className="mt-0.5 opacity-90">{message}</p>
      {onRetry ? (
        <button onClick={onRetry} className="mt-2 font-medium underline underline-offset-2">
          Try again
        </button>
      ) : null}
    </div>
  );
}
