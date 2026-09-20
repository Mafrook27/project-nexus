'use client';

import { useState } from 'react';
import { Flag, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Meter } from '@/components/ui/Meter';
import { StatTile } from '@/components/ui/StatTile';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import { EmptyState, ErrorNote } from '@/components/ui/States';
import { GoalsSkeleton } from '@/components/skeletons/PageSkeletons';
import { useToast } from '@/components/ui/Toast';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { formatDate, monthsBetween, toISODate } from '@/lib/date';
import { GOAL_KINDS, labelOf } from '@/lib/constants';
import { monthsToTarget } from '@/features/calculators/math';
import { useReference } from '@/features/settings/ReferenceData';
import type { Goal } from '../schema';

export function GoalsView() {
  const { currency, fire } = useReference();
  const { toast } = useToast();
  const { run } = useAction();
  const { data, error, loading, reload } = useResource<Goal[]>('/api/goals');
  const [editing, setEditing] = useState<Goal | null>(null);
  const [adding, setAdding] = useState(false);

  const goals = data ?? [];
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount), 0);
  const monthlyNeeded = goals.reduce((s, g) => s + Number(g.monthly_contribution), 0);

  async function remove(goal: Goal) {
    if (!confirm(`Delete the goal "${goal.name}"?`)) return;
    const done = await run(() => api.del(`/api/goals/${goal.id}`));
    if (done) {
      toast('Goal deleted');
      void reload();
    }
  }

  if (loading && !data) return <GoalsSkeleton />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Goals</h1>

        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add goal
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="You need" value={formatMoney(totalTarget, currency)} icon={<Flag className="size-4" />} />
        <StatTile
          label="You have"
          value={formatMoney(totalSaved, currency)}
          sub={totalTarget ? `${((totalSaved / totalTarget) * 100).toFixed(0)}% of the way` : undefined}
        />
        <StatTile label="Per month" value={formatMoney(monthlyNeeded, currency)} />
      </div>

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {goals.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const saved = Number(g.saved_amount);
            const target = Number(g.target_amount);
            const monthly = Number(g.monthly_contribution);
            const done = saved >= target;
            const months = monthsToTarget(saved, monthly, fire.pre_retirement_return, target);
            const deadlineMonths = g.target_date ? monthsBetween(toISODate(), g.target_date) : null;
            const late = months !== null && deadlineMonths !== null && months > deadlineMonths;

            return (
              <Card key={g.id} className="group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-ink">{g.name}</h3>
                    <p className="text-[12.5px] text-ink-muted">
                      {labelOf(GOAL_KINDS, g.kind)}
                      {g.target_date ? ` · by ${formatDate(g.target_date)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      onClick={() => setEditing(g)}
                      aria-label="Edit goal"
                      className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => remove(g)}
                      aria-label="Delete goal"
                      className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <p className="num-mono mt-3 text-[22px] font-semibold text-ink">
                  {formatMoney(saved, currency)}
                  <span className="ml-1.5 text-[13px] font-normal text-ink-muted">
                    of {formatMoney(target, currency)}
                  </span>
                </p>

                <Meter
                  value={saved}
                  max={target}
                  className="mt-3"
                  tone={done ? 'good' : late ? 'warn' : 'brand'}
                  caption={
                    done
                      ? 'Funded. Move it into an investment when you are ready.'
                      : monthly > 0
                        ? months === null
                          ? 'Increase the monthly amount to reach this.'
                          : `About ${Math.ceil(months / 12) > 1 ? `${(months / 12).toFixed(1)} years` : `${months} months`} away at ${formatMoney(monthly, currency)} a month.`
                        : 'Set a monthly contribution to see a date.'
                  }
                />

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {done ? <Badge tone="good">Reached</Badge> : null}
                  {late ? <Badge tone="warn">Behind the target date</Badge> : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : data ? (
        <Card>
          <EmptyState
            icon={<Flag className="size-5" />}
            title="No goals yet"
            description="Name what you are saving for and this tells you when you will get there."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Add goal
              </Button>
            }
          />
        </Card>
      ) : null}

      <GoalModal
        open={adding || Boolean(editing)}
        goal={editing}
        currency={currency}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={() => {
          void reload();
          setAdding(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function GoalModal({
  open,
  goal,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  goal: Goal | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { run, pending, error, fields } = useAction();
  const blank = {
    name: '',
    kind: 'custom',
    target_amount: '',
    saved_amount: '0',
    monthly_contribution: '',
    target_date: '',
  };
  const [form, setForm] = useState(blank);
  const [seed, setSeed] = useState<string | null>(null);
  const key = goal?.id ?? 'new';
  if (open && seed !== key) {
    setSeed(key);
    setForm(
      goal
        ? {
            name: goal.name,
            kind: goal.kind,
            target_amount: String(goal.target_amount),
            saved_amount: String(goal.saved_amount),
            monthly_contribution: String(goal.monthly_contribution),
            target_date: goal.target_date?.slice(0, 10) ?? '',
          }
        : blank,
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const saved = goal
      ? await run(() => api.patch(`/api/goals/${goal.id}`, form))
      : await run(() => api.post('/api/goals', form));
    if (saved) {
      toast(goal ? 'Goal updated' : 'Goal added');
      setSeed(null);
      onSaved();
    }
  }

  const symbol = currency === 'INR' ? '₹' : '$';

  return (
    <Modal
      open={open}
      onClose={() => {
        setSeed(null);
        onClose();
      }}
      title={goal ? 'Edit goal' : 'Add goal'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="What are you saving for?" error={fields.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Emergency fund"
            required
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
            >
              {GOAL_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target date">
            <Input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target amount" error={fields.target_amount}>
            <MoneyInput
              symbol={symbol}
              value={form.target_amount}
              onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))}
              required
            />
          </Field>
          <Field label="You have">
            <MoneyInput
              symbol={symbol}
              value={form.saved_amount}
              onChange={(e) => setForm((f) => ({ ...f, saved_amount: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Monthly contribution" hint="How much you put aside each month">
          <MoneyInput
            symbol={symbol}
            value={form.monthly_contribution}
            onChange={(e) => setForm((f) => ({ ...f, monthly_contribution: e.target.value }))}
          />
        </Field>

        {error ? (
          <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {goal ? 'Save changes' : 'Add goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
