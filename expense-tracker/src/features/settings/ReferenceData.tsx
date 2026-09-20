'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { Person } from '@/features/people/schema';
import type { Category } from '@/features/categories/schema';
import type { Account } from '@/features/accounts/schema';
import type { FireSettings } from '@/features/settings/schema';
import { DEFAULT_FIRE_SETTINGS } from '@/features/settings/schema';

export type Me = {
  id: string;
  email: string;
  name: string;
  currency: string;
  settings: FireSettings;
};

type Ctx = {
  me: Me | null;
  people: Person[];
  categories: Category[];
  accounts: Account[];
  currency: string;
  fire: Required<FireSettings>;
  /** How many automatically detected transactions are waiting for an answer. */
  reviewCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ReferenceContext = createContext<Ctx>({
  me: null,
  people: [],
  categories: [],
  accounts: [],
  currency: 'INR',
  fire: DEFAULT_FIRE_SETTINGS,
  reviewCount: 0,
  loading: true,
  refresh: async () => {},
});

/** People, categories and accounts are needed by nearly every form, so they are
 *  fetched once for the whole signed-in shell instead of per page. */
export function ReferenceDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    me: Me | null;
    people: Person[];
    categories: Category[];
    accounts: Account[];
    reviewCount: number;
    loading: boolean;
  }>({ me: null, people: [], categories: [], accounts: [], reviewCount: 0, loading: true });

  const refresh = useCallback(async () => {
    try {
      const [me, people, categories, accounts, review] = await Promise.all([
        api.get<Me>('/api/auth/me'),
        api.get<Person[]>('/api/people'),
        api.get<Category[]>('/api/categories'),
        api.get<Account[]>('/api/accounts'),
        api.get<{ count: number }>('/api/transactions/review').catch(() => ({ count: 0 })),
      ]);
      setState({ me, people, categories, accounts, reviewCount: review.count, loading: false });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      currency: state.me?.currency ?? 'INR',
      fire: { ...DEFAULT_FIRE_SETTINGS, ...(state.me?.settings ?? {}) },
      refresh,
    }),
    [state, refresh],
  );

  return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

export const useReference = () => useContext(ReferenceContext);

/** Formats money in the signed-in user's currency without prop-drilling it. */
export function useCurrency() {
  return useReference().currency;
}
