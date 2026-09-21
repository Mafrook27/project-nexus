import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Horizontal scroll is kept inside the card so phones never scroll the page. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <table className="w-full min-w-[520px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      className={cn(
        'border-b border-line pb-2 text-[12px] font-medium tracking-wide text-ink-muted uppercase',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <td
      className={cn(
        'border-b border-line py-2.5 text-ink',
        align === 'right' && 'text-right num-mono',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}
