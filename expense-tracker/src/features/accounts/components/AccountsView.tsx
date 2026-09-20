'use client';

import { useState } from 'react';
import { Banknote, CreditCard, Landmark, Pencil, Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState, ErrorNote, LoadingCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { ACCOUNT_TYPES, labelOf } from '@/lib/constants';
import { useReference } from '@/features/settings/ReferenceData';
import type { Account } from '../schema';

const ICONS: Record<string, typeof Landmark> = {
  bank: Landmark,
  cash: Banknote,
  wallet: Smartphone,
  credit_card: CreditCard,
};

export function AccountsView() {
  const { people, currency, refresh } = useReference();
  const { toast } = useToast();
  const { run } = useAction();
  const { data, error, loading, reload } = useResource<Account[]>('/api/accounts');
  const [editing, setEditing] = useState<Account | null>(null);
  const [adding, setAdding] = useState(false);

  const accounts = data ?? [];
  const live = accounts.filter((a) => !a.archived);
  const cash = live.filter((a) => a.type !== 'credit_card').reduce((s, a) => s + Number(a.balance), 0);
  const dues = live
    .filter((a) => a.type === 'credit_card')
    .reduce((s, a) => s + Math.max(0, -Number(a.balance)), 0);
  const emergency = live
    .filter((a) => a.is_emergency)
    .reduce((s, a) => s + Number(a.balance), 0);

  async function remove(account: Account) {
    if (!confirm(`Delete "${account.name}"? Transactions stay but lose their account.`)) return;
    const done = await run(() => api.del(`/api/accounts/${account.id}`));
    if (done) {
      toast('Account deleted');
      void reload();
      void refresh();
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Accounts</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Bank, cash, UPI wallets and cards — balances update from your transactions.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add account
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile label="Cash & bank" value={formatMoney(cash, currency)} icon={<Landmark className="size-4" />} />
        <StatTile
          label="Emergency fund"
          value={formatMoney(emergency, currency)}
          sub={emergency ? 'Marked accounts' : 'Mark an account below'}
          icon={<ShieldCheck className="size-4" />}
        />
        <StatTile
          label="Card dues"
          value={formatMoney(dues, currency)}
          sub="Outstanding on credit cards"
          icon={<CreditCard className="size-4" />}
        />
      </div>

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingCard height="h-60" /> : null}

      {data ? (
        accounts.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => {
              const Icon = ICONS[a.type] ?? Landmark;
              const isCard = a.type === 'credit_card';
              return (
                <Card key={a.id} className={a.archived ? 'opacity-60' : undefined}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                      <Icon className="size-4.5" />
                    </span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => setEditing(a)}
                        aria-label="Edit account"
                        className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => remove(a)}
                        aria-label="Delete account"
                        className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <h3 className="mt-3 truncate text-[15px] font-semibold text-ink">{a.name}</h3>
                  <p className="text-[12.5px] text-ink-muted">
                    {labelOf(ACCOUNT_TYPES, a.type)}
                    {a.institution ? ` · ${a.institution}` : ''}
                    {a.person_name ? ` · ${a.person_name}` : ''}
                  </p>
                  <p className="tnum mt-3 text-[22px] font-semibold text-ink">
                    {formatMoney(isCard ? Math.abs(Number(a.balance)) : Number(a.balance), currency)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {isCard ? <Badge tone="warn">Outstanding</Badge> : null}
                    {a.is_emergency ? <Badge tone="good">Emergency fund</Badge> : null}
                    {a.archived ? <Badge>Archived</Badge> : null}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<Landmark className="size-5" />}
              title="No accounts yet"
              description="Add your salary account, a cash wallet and any credit cards to see real balances."
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus className="size-4" /> Add account
                </Button>
              }
            />
          </Card>
        )
      ) : null}

      <AccountModal
        open={adding || Boolean(editing)}
        account={editing}
        people={people}
        currency={currency}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={() => {
          void reload();
          void refresh();
          setAdding(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function AccountModal({
  open,
  account,
  people,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: Account | null;
  people: { id: string; name: string }[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { run, pending, error, fields } = useAction();
  const [form, setForm] = useState({
    name: '',
    type: 'bank',
    institution: '',
    person_id: '',
    opening_balance: '0',
    is_emergency: false,
    archived: false,
  });

  // Re-seed the form whenever a different account is opened.
  const [seed, setSeed] = useState<string | null>(null);
  const key = account?.id ?? 'new';
  if (open && seed !== key) {
    setSeed(key);
    setForm({
      name: account?.name ?? '',
      type: account?.type ?? 'bank',
      institution: account?.institution ?? '',
      person_id: account?.person_id ?? '',
      opening_balance: String(account?.opening_balance ?? 0),
      is_emergency: account?.is_emergency ?? false,
      archived: account?.archived ?? false,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const saved = account
      ? await run(() => api.patch(`/api/accounts/${account.id}`, form))
      : await run(() => api.post('/api/accounts', form));
    if (saved) {
      toast(account ? 'Account updated' : 'Account added');
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
      title={account ? 'Edit account' : 'Add account'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={fields.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="HDFC Salary"
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
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Belongs to">
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
          <Field label="Bank / provider">
            <Input
              value={form.institution}
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              placeholder="HDFC Bank"
            />
          </Field>
          <Field
            label="Opening balance"
            hint="Balance before you started tracking"
            error={fields.opening_balance}
          >
            <MoneyInput
              symbol={currency === 'INR' ? '₹' : '$'}
              value={form.opening_balance}
              onChange={(e) => setForm((f) => ({ ...f, opening_balance: e.target.value }))}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-line p-3">
          <input
            type="checkbox"
            checked={form.is_emergency}
            onChange={(e) => setForm((f) => ({ ...f, is_emergency: e.target.checked }))}
            className="mt-0.5 size-4 accent-[var(--color-brand)]"
          />
          <span>
            <span className="block text-[13.5px] font-medium text-ink">
              This is my emergency fund
            </span>
            <span className="block text-[12.5px] text-ink-muted">
              Counted against your months-of-expenses target on the dashboard.
            </span>
          </span>
        </label>

        {account ? (
          <label className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
            <input
              type="checkbox"
              checked={form.archived}
              onChange={(e) => setForm((f) => ({ ...f, archived: e.target.checked }))}
              className="size-4 accent-[var(--color-brand)]"
            />
            Archive this account
          </label>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {account ? 'Save changes' : 'Add account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
