'use client';

import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Meter } from '@/components/ui/Meter';
import { StatTile } from '@/components/ui/StatTile';
import { MoneyInput } from '@/components/ui/Field';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorNote, LoadingCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAction, useResource } from '@/hooks/useResource';
import { api, withQuery } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { monthKey, monthLabel } from '@/lib/date';
import { useReference } from '@/features/settings/ReferenceData';
import type { Budget } from '../schema';
import type { DashboardData } from '@/features/dashboard/service';

/**
 * A budget is one number per category per month. `default` means "every month
 * unless a specific month overrides it", which is how people actually budget.
 */
export function BudgetsView() {
  const { categories, currency } = useReference();
  const { toast } = useToast();
  const { run, pending } = useAction();

  const [month, setMonth] = useState(monthKey());
  const [scope, setScope] = useState<'month' | 'default'>('default');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const budgets = useResource<Budget[]>('/api/budgets');
  const dashboard = useResource<DashboardData>(withQuery('/api/dashboard', { month }));

  const targetMonth = scope === 'default' ? 'default' : month;
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of dashboard.data?.byCategory ?? []) map.set(row.id, Number(row.amount));
    return map;
  }, [dashboard.data]);

  const currentBudgets = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const b of budgets.data ?? []) {
      if (b.month === targetMonth) map.set(b.category_id, b);
    }
    return map;
  }, [budgets.data, targetMonth]);

  const totalBudget = [...currentBudgets.values()].reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = expenseCategories.reduce(
    (s, c) => (currentBudgets.has(c.id) ? s + (spentByCategory.get(c.id) ?? 0) : s),
    0,
  );
  const overCount = [...currentBudgets.values()].filter(
    (b) => (spentByCategory.get(b.category_id) ?? 0) > Number(b.amount),
  ).length;

  async function save(categoryId: string) {
    const raw = drafts[categoryId];
    if (raw === undefined) return;
    const amount = Number(raw.replace(/[^0-9.]/g, ''));
    const existing = currentBudgets.get(categoryId);

    let done: unknown = null;
    if (!amount || amount <= 0) {
      done = existing ? await run(() => api.del(`/api/budgets/${existing.id}`)) : true;
    } else if (existing) {
      done = await run(() => api.patch(`/api/budgets/${existing.id}`, { amount }));
    } else {
      done = await run(() =>
        api.post('/api/budgets', { category_id: categoryId, month: targetMonth, amount }),
      );
    }
    if (done) {
      setDrafts((d) => {
        const next = { ...d };
        delete next[categoryId];
        return next;
      });
      void budgets.reload();
      toast('Budget saved');
    }
  }

  const loading = budgets.loading && !budgets.data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Budgets</h1>

        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'default' as const, label: 'Every month' },
              { value: 'month' as const, label: 'This month only' },
            ]}
            size="sm"
          />
          <MonthPicker value={month} onChange={setMonth} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="Your limit" value={formatMoney(totalBudget, currency)} icon={<Target className="size-4" />} />
        <StatTile
          label={`Spent in ${monthLabel(month)}`}
          value={formatMoney(totalSpent, currency)}
          sub={totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(0)}% of budget` : undefined}
        />
        <StatTile
          label="Over the limit"
          value={String(overCount)}
          sub={overCount ? 'need attention' : 'all within limit'}
        />
      </div>

      {budgets.error ? <ErrorNote message={budgets.error} onRetry={budgets.reload} /> : null}
      {loading ? <LoadingCard height="h-96" /> : null}

      {!loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {(['home', 'personal'] as const).map((bucket) => {
            const list = expenseCategories.filter((c) => c.bucket === bucket);
            return (
              <Card key={bucket}>
                <CardHeader
                  title={bucket === 'home' ? 'Home' : 'Personal'}
                  subtitle={
                    scope === 'default'
                      ? 'Applies to every month'
                      : `Override for ${monthLabel(month, true)}`
                  }
                />
                {list.length ? (
                  <ul className="space-y-4">
                    {list.map((c) => {
                      const existing = currentBudgets.get(c.id);
                      const spent = spentByCategory.get(c.id) ?? 0;
                      const limit = Number(existing?.amount ?? 0);
                      const draft = drafts[c.id];
                      const dirty = draft !== undefined;
                      return (
                        <li key={c.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ background: c.color }}
                            />
                            <span className="flex-1 truncate text-[13.5px] font-medium text-ink">
                              {c.name}
                            </span>
                            <div className="w-32 shrink-0">
                              <MoneyInput
                                symbol={currency === 'INR' ? '₹' : '$'}
                                value={dirty ? draft : limit ? String(limit) : ''}
                                placeholder="No limit"
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                                }
                                onBlur={() => save(c.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="h-9 text-[13px]"
                              />
                            </div>
                            {dirty ? (
                              <Button size="sm" loading={pending} onClick={() => save(c.id)}>
                                Save
                              </Button>
                            ) : null}
                          </div>
                          {limit > 0 ? (
                            <Meter
                              value={spent}
                              max={limit}
                              className="mt-2"
                              tone={spent > limit ? 'bad' : spent > limit * 0.85 ? 'warn' : 'brand'}
                              caption={
                                spent > limit
                                  ? `Over by ${formatMoney(spent - limit, currency)} in ${monthLabel(month)}`
                                  : `${formatMoney(spent, currency)} spent · ${formatMoney(limit - spent, currency)} left`
                              }
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState title="No categories here" description="Add one in Settings." />
                )}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
