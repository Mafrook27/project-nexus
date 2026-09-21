'use client';

import { useMemo, useState } from 'react';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { useReference } from '@/features/settings/ReferenceData';
import { useAction } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { toISODate } from '@/lib/date';
import { BUCKETS, NEED_COLORS, NEED_LEVELS, TXN_TYPES } from '@/lib/constants';
import type { Transaction } from '../schema';

export type TransactionDraft = Partial<Transaction>;

const symbolFor = (currency: string) =>
  currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';

export function TransactionForm({
  initial,
  onSaved,
  onCancel,
  submitLabel = 'Save',
}: {
  initial?: TransactionDraft;
  onSaved: (saved: Transaction, keepOpen: boolean) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const { categories, accounts, people, currency } = useReference();
  const { run, pending, error, fields } = useAction();

  const [form, setForm] = useState({
    type: (initial?.type ?? 'expense') as 'expense' | 'income' | 'transfer',
    bucket: (initial?.bucket ?? 'personal') as 'home' | 'personal',
    need_level: (initial?.need_level ?? 'need') as 'need' | 'want' | 'waste',
    amount: initial?.amount ? String(initial.amount) : '',
    txn_date: initial?.txn_date?.slice(0, 10) ?? toISODate(),
    category_id: initial?.category_id ?? '',
    account_id: initial?.account_id ?? '',
    to_account_id: initial?.to_account_id ?? '',
    person_id: initial?.person_id ?? '',
    merchant: initial?.merchant ?? '',
    note: initial?.note ?? '',
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const [levelTouched, setLevelTouched] = useState(false);

  /** Picking a category suggests a level, until you pick one yourself. */
  function chooseCategory(id: string) {
    const category = categories.find((c) => c.id === id);
    setForm((f) => ({
      ...f,
      category_id: id,
      bucket: category?.bucket ?? f.bucket,
      need_level: levelTouched ? f.need_level : (category?.default_need_level ?? f.need_level),
    }));
  }

  const isTransfer = form.type === 'transfer';
  const relevantCategories = useMemo(
    () =>
      categories
        .filter((c) => c.kind === (form.type === 'income' ? 'income' : 'expense'))
        .sort((a, b) => (a.bucket === form.bucket ? -1 : 1) - (b.bucket === form.bucket ? -1 : 1)),
    [categories, form.type, form.bucket],
  );

  async function submit(e: React.FormEvent, keepOpen = false) {
    e.preventDefault();
    const payload = {
      ...form,
      amount: form.amount,
      category_id: isTransfer ? '' : form.category_id,
      to_account_id: isTransfer ? form.to_account_id : '',
    };
    const saved = initial?.id
      ? await run(() => api.patch<Transaction>(`/api/transactions/${initial.id}`, payload))
      : await run(() => api.post<Transaction>('/api/transactions', payload));
    if (saved) {
      onSaved(saved, keepOpen);
      if (keepOpen) setForm((f) => ({ ...f, amount: '', merchant: '', note: '' }));
    }
  }

  return (
    <form onSubmit={(e) => submit(e, false)} className="space-y-4" noValidate>
      <Segmented
        value={form.type}
        onChange={(v) => set('type', v)}
        options={TXN_TYPES}
        className="w-full [&>button]:flex-1"
      />

      <Field label="Amount" error={fields.amount}>
        <MoneyInput
          symbol={symbolFor(currency)}
          value={form.amount}
          onChange={(e) => set('amount', e.target.value)}
          placeholder="0"
          autoFocus
          className="h-12 text-lg font-semibold"
          required
        />
      </Field>

      {form.type === 'expense' ? (
        <Field label="Was this worth it?">
          <div className="grid grid-cols-3 gap-2">
            {NEED_LEVELS.map((level) => {
              const active = form.need_level === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => {
                    setLevelTouched(true);
                    set('need_level', level.value);
                  }}
                  className={`rounded-xl border px-2 py-2.5 text-center transition ${
                    active
                      ? 'border-transparent text-white'
                      : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-sunken'
                  }`}
                  style={active ? { background: NEED_COLORS[level.value] } : undefined}
                >
                  <span className="block text-[13px] font-medium">{level.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-ink-muted">
            {NEED_LEVELS.find((l) => l.value === form.need_level)?.hint}
          </p>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={fields.txn_date}>
          <Input
            type="date"
            value={form.txn_date}
            onChange={(e) => set('txn_date', e.target.value)}
            required
          />
        </Field>
        <Field label="Home or personal">
          <Segmented
            value={form.bucket}
            onChange={(v) => set('bucket', v)}
            options={BUCKETS}
            className="h-10 w-full [&>button]:flex-1"
          />
        </Field>
      </div>

      {isTransfer ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From account" error={fields.account_id}>
            <Select value={form.account_id} onChange={(e) => set('account_id', e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To account" error={fields.to_account_id}>
            <Select
              value={form.to_account_id}
              onChange={(e) => set('to_account_id', e.target.value)}
            >
              <option value="">Select…</option>
              {accounts
                .filter((a) => a.id !== form.account_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" error={fields.category_id}>
            <Select value={form.category_id} onChange={(e) => chooseCategory(e.target.value)}>
              <option value="">Not sorted yet</option>
              {relevantCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account">
            <Select value={form.account_id} onChange={(e) => set('account_id', e.target.value)}>
              <option value="">Not tracked</option>
              {accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Whose" hint="Useful for family spends">
          <Select value={form.person_id} onChange={(e) => set('person_id', e.target.value)}>
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Paid to / from">
          <Input
            value={form.merchant ?? ''}
            onChange={(e) => set('merchant', e.target.value)}
            placeholder="Big Bazaar, Zomato…"
          />
        </Field>
      </div>

      <Field label="Note" error={fields.note}>
        <Textarea
          value={form.note ?? ''}
          onChange={(e) => set('note', e.target.value)}
          placeholder="Anything worth remembering"
          rows={2}
        />
      </Field>

      {error ? (
        <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {!initial?.id ? (
          <Button type="button" variant="secondary" loading={pending} onClick={(e) => submit(e, true)}>
            Save &amp; add another
          </Button>
        ) : null}
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
