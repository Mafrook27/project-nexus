'use client';

import { useState, type ReactNode } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Wraps a chart with its title, legend and a table view. Three of the palette's
 * light-mode hues sit below 3:1 against white, so a readable text alternative
 * is not optional - it ships with every chart.
 */
export function ChartFrame({
  title,
  subtitle,
  legend,
  table,
  action,
  children,
  className,
  height = 'h-[260px]',
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  table?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: string;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      className={cn(
        'rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5',
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {table ? (
            <button
              onClick={() => setShowTable((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[12px] font-medium text-ink-soft hover:bg-surface-sunken"
              aria-pressed={showTable}
            >
              {showTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
              {showTable ? 'Chart' : 'Table'}
            </button>
          ) : null}
        </div>
      </header>

      {legend && legend.length > 1 ? (
        <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm ring-2 ring-surface"
                style={{ background: l.color }}
              />
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}

      {showTable && table ? <div className="overflow-x-auto">{table}</div> : (
        <div className={cn('w-full', height)}>{children}</div>
      )}
    </section>
  );
}
