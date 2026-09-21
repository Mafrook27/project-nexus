'use client';

import type { ReactNode } from 'react';
import { formatMoney } from '@/lib/money';

/** One tooltip shape for every chart in the app. */
export function TooltipCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-pop)]">
      <p className="mb-1 text-[12px] font-medium text-ink-muted">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 text-[13px]">
      <span className="flex items-center gap-1.5 text-ink-soft">
        {color ? (
          <span
            className="inline-block size-2.5 rounded-sm ring-2 ring-surface"
            style={{ background: color }}
          />
        ) : null}
        {label}
      </span>
      <span className="num-mono font-medium text-ink">{value}</span>
    </div>
  );
}

type Entry = {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
};

type ContentProps = {
  active?: boolean;
  payload?: readonly Entry[];
  label?: unknown;
};

/**
 * Builds a Recharts `content` renderer that lists every series at the hovered
 * point, formatted as money.
 */
export function moneyTooltip(currency: string, formatTitle: (label: string) => string) {
  return function Content(props: ContentProps) {
    const { active, payload, label } = props;
    if (!active || !payload?.length) return null;
    return (
      <TooltipCard title={formatTitle(String(label ?? ''))}>
        {payload.map((entry, i) => (
          <TooltipRow
            key={`${String(entry.dataKey)}-${i}`}
            color={entry.color}
            label={String(entry.name ?? entry.dataKey ?? '')}
            value={formatMoney(Number(entry.value ?? 0), currency)}
          />
        ))}
      </TooltipCard>
    );
  };
}

/** Same tooltip, for series measured in percent rather than currency. */
export function percentTooltip(formatTitle: (label: string) => string) {
  return function Content(props: ContentProps) {
    const { active, payload, label } = props;
    if (!active || !payload?.length) return null;
    return (
      <TooltipCard title={formatTitle(String(label ?? ''))}>
        {payload.map((entry, i) => (
          <TooltipRow
            key={`${String(entry.dataKey)}-${i}`}
            color={entry.color}
            label={String(entry.name ?? entry.dataKey ?? '')}
            value={`${Number(entry.value ?? 0).toFixed(0)}%`}
          />
        ))}
      </TooltipCard>
    );
  };
}
