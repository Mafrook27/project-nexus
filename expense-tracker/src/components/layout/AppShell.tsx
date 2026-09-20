'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { LogOut, Menu, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { ALL_NAV, MOBILE_NAV, NAV_GROUPS, SETTINGS_ITEM } from './nav';
import { useReference } from '@/features/settings/ReferenceData';
import { Skeleton } from '@/components/ui/Skeleton';
import { QuickAdd } from '@/features/transactions/components/QuickAdd';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, reviewCount, loading: loadingMe } = useReference();
  const [drawer, setDrawer] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);

  const current = ALL_NAV.find((i) => pathname.startsWith(i.href));

  async function signOut() {
    await api.post('/api/auth/logout');
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Brand />
        <div className="px-3 pb-4">
          <button
            onClick={() => setQuickAdd(true)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[13.5px] font-medium text-white transition hover:bg-brand-strong"
          >
            <Plus className="size-4" /> Add transaction
          </button>
        </div>
        <NavList pathname={pathname} reviewCount={reviewCount} />
        <Footer me={me} loading={loadingMe} onSignOut={signOut} />
      </aside>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-[#0b0d12]/40"
            onClick={() => setDrawer(false)}
          />
          <div className="rise relative flex h-full w-72 flex-col bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <button
                onClick={() => setDrawer(false)}
                aria-label="Close menu"
                className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <NavList
              pathname={pathname}
              reviewCount={reviewCount}
              onNavigate={() => setDrawer(false)}
            />
            <Footer me={me} loading={loadingMe} onSignOut={signOut} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="no-print safe-top sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/90 px-3 py-2.5 backdrop-blur lg:hidden">
          <button
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-surface-sunken"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-[15px] font-semibold">{current?.label ?? 'Paisa'}</span>
          <button
            onClick={() => setQuickAdd(true)}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-[13px] font-medium text-white"
          >
            <Plus className="size-4" /> Add
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-4 pb-24 sm:px-6 lg:pb-10">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pt-1 shadow-[0_-1px_3px_rgba(11,13,18,0.04)] lg:hidden">
          {MOBILE_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium',
                  active ? 'text-brand' : 'text-ink-muted',
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.3 : 1.8} />
                  {item.badge === 'review' && reviewCount > 0 ? (
                    <span className="num-mono absolute -top-1.5 -right-2.5 rounded-full bg-bad px-1 py-px text-[10px] font-semibold text-white">
                      {reviewCount > 9 ? '9+' : reviewCount}
                    </span>
                  ) : null}
                </span>
                {item.short ?? item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <QuickAdd open={quickAdd} onClose={() => setQuickAdd(false)} />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
      <span className="grid size-8 place-items-center rounded-xl bg-brand text-[15px] font-bold text-white">
        ₹
      </span>
      <span className="text-[17px] font-semibold tracking-tight">Paisa</span>
    </div>
  );
}

function NavList({
  pathname,
  reviewCount,
  onNavigate,
}: {
  pathname: string;
  reviewCount: number;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 pb-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="mb-5">
          <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition',
                      active
                        ? 'bg-brand-soft text-brand-strong'
                        : 'text-ink-soft hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    <Icon className="size-4.5" strokeWidth={active ? 2.2 : 1.8} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge === 'review' && reviewCount > 0 ? (
                      <span className="num-mono rounded-md bg-bad px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {reviewCount}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Footer({
  me,
  loading,
  onSignOut,
}: {
  me: { name: string; email: string } | null;
  loading?: boolean;
  onSignOut: () => void;
}) {
  const SettingsIcon = SETTINGS_ITEM.icon;
  return (
    <div className="border-t border-line p-3">
      <Link
        href={SETTINGS_ITEM.href}
        className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium text-ink-soft hover:bg-surface-sunken hover:text-ink"
      >
        <SettingsIcon className="size-4.5" strokeWidth={1.8} />
        Settings
      </Link>
      <div className="mt-2 flex items-center gap-2.5 rounded-xl px-2.5 py-2">
        {loading && !me ? (
          <>
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-2.5 w-28 rounded" />
            </div>
          </>
        ) : (
          <>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-[13px] font-semibold text-ink-soft">
              {(me?.name ?? 'U').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{me?.name ?? '—'}</p>
              <p className="truncate text-[11.5px] text-ink-muted">{me?.email ?? ''}</p>
            </div>
          </>
        )}
        <button
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-bad"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}
