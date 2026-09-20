'use client';

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const base =
  'w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted ' +
  'transition focus:border-brand focus:outline-2 focus:outline-offset-0 focus:outline-brand/25 ' +
  'disabled:bg-surface-sunken disabled:text-ink-muted';

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label ? (
        <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-bad">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-ink-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(base, 'h-10', className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(base, 'py-2.5', className)} rows={props.rows ?? 3} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      className={cn(
        base,
        'h-10 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%23858c9a%27><path d=%27M5.5 7.5l4.5 4.5 4.5-4.5z%27/></svg>")] bg-[length:20px_20px] bg-[right_8px_center] bg-no-repeat pr-9',
        className,
      )}
    >
      {children}
    </select>
  );
}

/** Amount input with the currency symbol pinned inside. */
export function MoneyInput({
  className,
  symbol = '₹',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { symbol?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
        {symbol}
      </span>
      <input
        {...props}
        inputMode="decimal"
        className={cn(base, 'h-10 pl-7 num-mono', className)}
      />
    </div>
  );
}
