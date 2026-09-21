'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Sheet on phones, centred dialog on desktop. Escape and backdrop both close,
 * and body scroll is locked while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[#0b0d12]/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'rise relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-[var(--shadow-pop)]',
          'rounded-t-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-m-1 grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken"
          >
            <X className="size-4.5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="safe-bottom flex justify-end gap-2 border-t border-line bg-surface px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
