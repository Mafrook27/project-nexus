'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

type Toast = { id: number; message: string; tone: 'ok' | 'error' | 'info' };
type Ctx = { toast: (message: string, tone?: Toast['tone']) => void };

const ToastContext = createContext<Ctx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="rise pointer-events-auto flex max-w-md items-center gap-2 rounded-xl bg-[#0b0d12] px-3.5 py-2.5 text-[13px] text-white shadow-[var(--shadow-pop)]"
          >
            {t.tone === 'ok' ? (
              <CheckCircle2 className="size-4 text-[#7ee787]" />
            ) : t.tone === 'error' ? (
              <XCircle className="size-4 text-[#ff9c9c]" />
            ) : (
              <Info className="size-4 text-[#9ec5f4]" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
