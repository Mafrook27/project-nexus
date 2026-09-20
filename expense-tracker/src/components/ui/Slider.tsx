'use client';

import { cn } from '@/lib/cn';

/** Label + value + range, used all over the calculators. */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  display,
  hint,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  display?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="text-[13px] font-medium text-ink-soft">{label}</label>
        <span className="tnum text-[13px] font-semibold text-ink">{display ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-[var(--color-brand)] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(42,120,214,0.18)]"
      />
      {hint ? <p className="mt-1 text-[11.5px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}
