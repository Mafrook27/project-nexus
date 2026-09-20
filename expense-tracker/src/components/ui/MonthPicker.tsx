'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthKey, monthLabel, shiftMonth } from '@/lib/date';

/** Prev / next month stepper. Never steps past the current month. */
export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (month: string) => void;
}) {
  const atLatest = value >= monthKey();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
      <button
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label="Previous month"
        className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-sunken"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[104px] px-1 text-center text-[13px] font-medium text-ink">
        {monthLabel(value, true)}
      </span>
      <button
        onClick={() => !atLatest && onChange(shiftMonth(value, 1))}
        disabled={atLatest}
        aria-label="Next month"
        className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-sunken disabled:opacity-35"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
