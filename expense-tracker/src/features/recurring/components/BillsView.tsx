'use client';

import { useState } from 'react';
import { CalendarClock, Check, CreditCard, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/StatTile';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { TableWrap, Td, Th } from '@/components/ui/Table';
import { EmptyState, ErrorNote, LoadingCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { daysUntil, formatDate, toISODate } from '@/lib/date';
import { BUCKETS, FREQUENCIES, LIABILITY_TYPES, labelOf } from '@/lib/constants';
import { useReference } from '@/features/settings/ReferenceData';
import { monthlyEquivalent } from '../service';
import type { Recurring } from '../schema';
import type { Liability } from '@/features/liabilities/schema';

/** Recurring bills and outstanding loans - the money already promised away. */
export function BillsView() {
  const { categories, accounts, people, currency, refresh } = useReference();
  const { toast } = useToast();
  const { run } = useAction();

  const bills = useResource<Recurring[]>('/api/recurring');
  const loans = useResource<Liability[]>('/api/liabilities');

  const [editingBill, setEditingBill] = useState<Recurring | null>(null);
  const [addingBill, setAddingBill] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Liability | null>(null);
  const [addingLoan, setAddingLoan] = useState(false);

  const activeBills = (bills.data ?? []).filter((b) => b.active);
  const monthlyCommitted = activeBills
    .filter((b) => b.type === 'expense')
    .reduce((s, b) => s + monthlyEquivalent(Number(b.amount), b.frequency), 0);
  const totalEmi = (loans.data ?? []).reduce((s, l) => s + Number(l.emi), 0);
  const outstanding = (loans.data ?? []).reduce((s, l) => s + Number(l.outstanding), 0);

  async function postBill(bill: Recurring) {
    const done = await run(() => api.post(`/api/recurring/${bill.id}/post`));
    if (done) {
      toast(`${bill.name} recorded`);
      void bills.reload();
      void refresh();
    }
  }

  async function removeBill(bill: Recurring) {
    if (!confirm(`Delete the bill "${bill.name}"?`)) return;
    const done = await run(() => api.del(`/api/recurring/${bill.id}`));
    if (done) {
      toast('Bill deleted');
      void bills.reload();
    }
  }

  async function removeLoan(loan: Liability) {
    if (!confirm(`Delete "${loan.name}"?`)) return;
    const done = await run(() => api.del(`/api/liabilities/${loan.id}`));
    if (done) {
      toast('Loan deleted');
      void loans.reload();
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Bills &amp; EMIs</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Rent, subscriptions, insurance premiums and loan instalments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAddingLoan(true)}>
            <Plus className="size-4" /> Loan
          </Button>
          <Button size="sm" onClick={() => setAddingBill(true)}>
            <Plus className="size-4" /> Bill
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Committed monthly"
          value={formatMoney(monthlyCommitted, currency)}
          sub={`${activeBills.length} active bills`}
          icon={<CalendarClock className="size-4" />}
        />
        <StatTile label="EMIs" value={formatMoney(totalEmi, currency)} sub="Every month" icon={<CreditCard className="size-4" />} />
        <StatTile label="Outstanding debt" value={formatMoney(outstanding, currency)} />
      </div>

      {bills.error ? <ErrorNote message={bills.error} onRetry={bills.reload} /> : null}
      {bills.loading && !bills.data ? <LoadingCard height="h-64" /> : null}

      <Card>
        <CardHeader title="Recurring bills" subtitle="Mark one paid and it becomes a transaction" />
        {bills.data?.length ? (
          <ul className="divide-y divide-line">
            {bills.data.map((b) => {
              const days = daysUntil(b.next_due);
              const overdue = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 7;
              return (
                <li key={b.id} className="group flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{b.name}</p>
                    <p className="truncate text-[12px] text-ink-muted">
                      {labelOf(FREQUENCIES, b.frequency)} · due {formatDate(b.next_due)}
                      {b.category_name ? ` · ${b.category_name}` : ''}
                      {b.account_name ? ` · ${b.account_name}` : ''}
                    </p>
                  </div>
                  {!b.active ? <Badge>Paused</Badge> : null}
                  {overdue ? (
                    <Badge tone="bad">Overdue by {Math.abs(days!)}d</Badge>
                  ) : soon ? (
                    <Badge tone="warn">In {days}d</Badge>
                  ) : null}
                  <span className="tnum shrink-0 text-[14px] font-semibold">
                    {formatMoney(Number(b.amount), currency)}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={() => postBill(b)}
                      title="Mark as paid"
                      aria-label="Mark as paid"
                      className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-good-soft hover:text-good-ink"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      onClick={() => setEditingBill(b)}
                      aria-label="Edit bill"
                      className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => removeBill(b)}
                      aria-label="Delete bill"
                      className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<CalendarClock className="size-5" />}
            title="No recurring bills"
            description="Add rent, electricity, Netflix or insurance so nothing catches you off guard."
            action={
              <Button size="sm" onClick={() => setAddingBill(true)}>
                <Plus className="size-4" /> Add bill
              </Button>
            }
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Loans & debt" subtitle="Counted against your net worth" />
        {loans.data?.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th align="right">Outstanding</Th>
                <Th align="right">EMI</Th>
                <Th align="right">Rate</Th>
                <Th align="right">Ends</Th>
                <Th align="right"> </Th>
              </tr>
            </thead>
            <tbody>
              {loans.data.map((l) => (
                <tr key={l.id} className="group">
                  <Td>
                    <span className="font-medium text-ink">{l.name}</span>
                    {l.person_name ? (
                      <span className="block text-[12px] text-ink-muted">{l.person_name}</span>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="text-[13px] text-ink-soft">
                      {labelOf(LIABILITY_TYPES, l.type)}
                    </span>
                  </Td>
                  <Td align="right">{formatMoney(Number(l.outstanding), currency)}</Td>
                  <Td align="right">{formatMoney(Number(l.emi), currency)}</Td>
                  <Td align="right">{Number(l.interest_rate).toFixed(2)}%</Td>
                  <Td align="right">{l.end_date ? formatDate(l.end_date) : '—'}</Td>
                  <Td align="right">
                    <span className="flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        onClick={() => setEditingLoan(l)}
                        aria-label="Edit loan"
                        className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => removeLoan(l)}
                        aria-label="Delete loan"
                        className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="Debt free"
            description="Add a home loan, car loan or credit-card balance if you have one."
            action={
              <Button size="sm" variant="secondary" onClick={() => setAddingLoan(true)}>
                <Plus className="size-4" /> Add loan
              </Button>
            }
          />
        )}
      </Card>

      <BillModal
        open={addingBill || Boolean(editingBill)}
        bill={editingBill}
        categories={categories}
        accounts={accounts}
        currency={currency}
        onClose={() => {
          setAddingBill(false);
          setEditingBill(null);
        }}
        onSaved={() => {
          void bills.reload();
          setAddingBill(false);
          setEditingBill(null);
        }}
      />

      <LoanModal
        open={addingLoan || Boolean(editingLoan)}
        loan={editingLoan}
        people={people}
        currency={currency}
        onClose={() => {
          setAddingLoan(false);
          setEditingLoan(null);
        }}
        onSaved={() => {
          void loans.reload();
          setAddingLoan(false);
          setEditingLoan(null);
        }}
      />
    </div>
  );
}

function BillModal({
  open,
  bill,
  categories,
  accounts,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  bill: Recurring | null;
  categories: { id: string; name: string; kind: string }[];
  accounts: { id: string; name: string }[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { run, pending, error, fields } = useAction();
  const blank = {
    name: '',
    amount: '',
    type: 'expense' as 'expense' | 'income',
    bucket: 'home' as 'home' | 'personal',
    frequency: 'monthly',
    next_due: toISODate(),
    category_id: '',
    account_id: '',
    active: true,
  };
  const [form, setForm] = useState(blank);
  const [seed, setSeed] = useState<string | null>(null);
  const key = bill?.id ?? 'new';
  if (open && seed !== key) {
    setSeed(key);
    setForm(
      bill
        ? {
            name: bill.name,
            amount: String(bill.amount),
            type: bill.type,
            bucket: bill.bucket,
            frequency: bill.frequency,
            next_due: bill.next_due.slice(0, 10),
            category_id: bill.category_id ?? '',
            account_id: bill.account_id ?? '',
            active: bill.active,
          }
        : blank,
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const saved = bill
      ? await run(() => api.patch(`/api/recurring/${bill.id}`, form))
      : await run(() => api.post('/api/recurring', form));
    if (saved) {
      toast(bill ? 'Bill updated' : 'Bill added');
      setSeed(null);
      onSaved();
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setSeed(null);
        onClose();
      }}
      title={bill ? 'Edit bill' : 'Add recurring bill'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={fields.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="House rent"
            required
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" error={fields.amount}>
            <MoneyInput
              symbol={currency === 'INR' ? '₹' : '$'}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </Field>
          <Field label="Repeats">
            <Select
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Next due" error={fields.next_due}>
            <Input
              type="date"
              value={form.next_due}
              onChange={(e) => setForm((f) => ({ ...f, next_due: e.target.value }))}
              required
            />
          </Field>
          <Field label="Home or personal">
            <Segmented
              value={form.bucket}
              onChange={(v) => setForm((f) => ({ ...f, bucket: v }))}
              options={BUCKETS}
              className="h-10 w-full [&>button]:flex-1"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">—</option>
              {categories
                .filter((c) => c.kind === form.type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Paid from">
            <Select
              value={form.account_id}
              onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="size-4 accent-[var(--color-brand)]"
          />
          Active
        </label>

        {error ? (
          <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {bill ? 'Save changes' : 'Add bill'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function LoanModal({
  open,
  loan,
  people,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  loan: Liability | null;
  people: { id: string; name: string }[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { run, pending, error, fields } = useAction();
  const blank = {
    name: '',
    type: 'loan',
    person_id: '',
    principal: '',
    outstanding: '',
    interest_rate: '',
    emi: '',
    end_date: '',
  };
  const [form, setForm] = useState(blank);
  const [seed, setSeed] = useState<string | null>(null);
  const key = loan?.id ?? 'new';
  if (open && seed !== key) {
    setSeed(key);
    setForm(
      loan
        ? {
            name: loan.name,
            type: loan.type,
            person_id: loan.person_id ?? '',
            principal: String(loan.principal),
            outstanding: String(loan.outstanding),
            interest_rate: String(loan.interest_rate),
            emi: String(loan.emi),
            end_date: loan.end_date?.slice(0, 10) ?? '',
          }
        : blank,
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const saved = loan
      ? await run(() => api.patch(`/api/liabilities/${loan.id}`, form))
      : await run(() => api.post('/api/liabilities', form));
    if (saved) {
      toast(loan ? 'Loan updated' : 'Loan added');
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
      title={loan ? 'Edit loan' : 'Add loan'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={fields.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Home loan"
            required
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {LIABILITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Borrower">
            <Select
              value={form.person_id}
              onChange={(e) => setForm((f) => ({ ...f, person_id: e.target.value }))}
            >
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Original principal">
            <MoneyInput
              symbol={symbol}
              value={form.principal}
              onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))}
            />
          </Field>
          <Field label="Outstanding now">
            <MoneyInput
              symbol={symbol}
              value={form.outstanding}
              onChange={(e) => setForm((f) => ({ ...f, outstanding: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Rate %">
            <Input
              type="number"
              step="0.05"
              value={form.interest_rate}
              onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))}
            />
          </Field>
          <Field label="EMI">
            <MoneyInput
              symbol={symbol}
              value={form.emi}
              onChange={(e) => setForm((f) => ({ ...f, emi: e.target.value }))}
            />
          </Field>
          <Field label="Ends on">
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </Field>
        </div>

        {error ? (
          <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {loan ? 'Save changes' : 'Add loan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
