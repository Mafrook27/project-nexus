import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  neutral: 'bg-surface-sunken text-ink-soft',
  brand: 'bg-brand-soft text-brand-strong',
  good: 'bg-good-soft text-good-ink',
  warn: 'bg-warn-soft text-[#7a5200]',
  bad: 'bg-bad-soft text-bad',
} as const;

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ color }: { color?: string | null }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full ring-2 ring-surface"
      style={{ background: color ?? 'var(--color-ink-muted)' }}
    />
  );
}
