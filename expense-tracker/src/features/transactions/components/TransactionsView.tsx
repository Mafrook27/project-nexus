'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Filter, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, Dot } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { EmptyState, ErrorNote, LoadingCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useResource, useAction } from '@/hooks/useResource';
import { api, withQuery } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { formatDate, monthKey } from '@/lib/date';
import { NEED_LEVELS } from '@/lib/constants';
import { useReference } from '@/features/settings/ReferenceData';
import { TransactionForm } from './TransactionForm';
import { ImportDialog } from '@/features/import/components/ImportDialog';
import type { Transaction } from '../schema';

type ListResponse = { rows: Transaction[]; count: number; income: number; expense: number };

const BLANK_FILTERS = {
  type: '',
  bucket: '',
  need_level: '',
  category_id: '',
  account_id: '',
  person_id: '',
  q: '',
};

export function TransactionsView() {
  const params = useSearchParams();
  const { categories, accounts, people, currency, refresh } = useReference();
  const { toast } = useToast();
  const { run } = useAction();

  const [month, setMonth] = useState(monthKey());
  // Cards elsewhere link straight here, e.g. /transactions?need=waste
  const [filters, setFilters] = useState({
    ...BLANK_FILTERS,
    need_level: params.get('need') ?? '',
    category_id: params.get('category') ?? '',
  });
  const [showFilters, setShowFilters] = useState(
    Boolean(params.get('need') || params.get('category')),
  );
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const path = useMemo(
    () => withQuery('/api/transactions', { month, ...filters, limit: 300 }),
    [month, filters],
  );
  const { data, error, loading, reload } = useResource<ListResponse>(path);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  async function remove(id: string) {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    const done = await run(() => api.del(`/api/transactions/${id}`));
    if (done) {
      toast('Transaction deleted');
      void reload();
      void refresh();
    }
  }

  function afterWrite() {
    void reload();
    void refresh();
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Money in &amp; out</h1>
          {data ? (
            <p className="mt-1 text-[13.5px] text-ink-soft">
              <span className="font-semibold text-good-ink">
                {formatMoney(data.income, currency)} in
              </span>
              {' · '}
              <span className="font-semibold text-ink">
                {formatMoney(data.expense, currency)} out
              </span>
              {' · '}
              {data.count} entries
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} />
          <Button variant="secondary" size="sm" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="size-4" />
            Filter
            {activeFilters ? (
              <span className="ml-1 rounded-md bg-brand px-1.5 text-[11px] text-white">
                {activeFilters}
              </span>
            ) : null}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
            <Upload className="size-4" /> Import
          </Button>
          <a href="/api/export?type=transactions" download>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> Export
            </Button>
          </a>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </header>

      {showFilters ? (
        <Card className="rise">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Search">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
                <Input
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="Merchant or note"
                  className="pl-9"
                />
              </div>
            </Field>
            <Field label="Type">
              <Select
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="">All types</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </Select>
            </Field>
            <Field label="Worth it?">
              <Select
                value={filters.need_level}
                onChange={(e) => setFilters((f) => ({ ...f, need_level: e.target.value }))}
              >
                <option value="">All spending</option>
                {NEED_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Home or personal">
              <Select
                value={filters.bucket}
                onChange={(e) => setFilters((f) => ({ ...f, bucket: e.target.value }))}
              >
                <option value="">Both</option>
                <option value="home">Home</option>
                <option value="personal">Personal</option>
              </Select>
            </Field>
            <Field label="Category">
              <Select
                value={filters.category_id}
                onChange={(e) => setFilters((f) => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Account">
              <Select
                value={filters.account_id}
                onChange={(e) => setFilters((f) => ({ ...f, account_id: e.target.value }))}
              >
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Person">
              <Select
                value={filters.person_id}
                onChange={(e) => setFilters((f) => ({ ...f, person_id: e.target.value }))}
              >
                <option value="">Everyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {activeFilters ? (
            <button
              onClick={() => setFilters(BLANK_FILTERS)}
              className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline"
            >
              <X className="size-3.5" /> Clear filters
            </button>
          ) : null}
        </Card>
      ) : null}

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingCard height="h-96" /> : null}

      {data ? (
        data.rows.length ? (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {data.rows.map((t) => (
                <li key={t.id} className="group flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Dot color={t.category_color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">
                      {t.merchant || t.category_name || 'Transaction'}
                    </p>
                    <p className="truncate text-[12px] text-ink-muted">
                      {formatDate(t.txn_date)}
                      {t.category_name ? ` · ${t.category_name}` : ''}
                      {t.account_name ? ` · ${t.account_name}` : ''}
                      {t.person_name ? ` · ${t.person_name}` : ''}
                    </p>
                  </div>
                  {t.type === 'expense' && t.need_level === 'waste' ? (
                    <Badge tone="bad">Wasted</Badge>
                  ) : t.type === 'expense' && t.need_level === 'want' ? (
                    <Badge tone="warn">Nice to have</Badge>
                  ) : null}
                  <Badge tone={t.type === 'income' ? 'good' : 'neutral'}>
                    {t.bucket === 'home' ? 'Home' : 'Personal'}
                  </Badge>
                  <span
                    className={`num-mono shrink-0 text-[14px] font-semibold ${
                      t.type === 'income' ? 'text-good-ink' : 'text-ink'
                    }`}
                  >
                    {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '−'}
                    {formatMoney(t.amount, currency)}
                  </span>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      onClick={() => setEditing(t)}
                      aria-label="Edit"
                      className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      aria-label="Delete"
                      className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <EmptyState
              title="Nothing here yet"
              description="No transactions match this month and these filters."
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus className="size-4" /> Add transaction
                </Button>
              }
            />
          </Card>
        )
      ) : null}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add transaction">
        <TransactionForm
          onSaved={(_s, keepOpen) => {
            toast('Transaction saved');
            afterWrite();
            if (!keepOpen) setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit transaction">
        {editing ? (
          <TransactionForm
            initial={editing}
            submitLabel="Save changes"
            onSaved={() => {
              toast('Transaction updated');
              afterWrite();
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onDone={() => {
          afterWrite();
          setImporting(false);
        }}
      />
    </div>
  );
}
