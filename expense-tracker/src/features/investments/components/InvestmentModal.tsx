'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAction } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { INVESTMENT_TYPES } from '@/lib/constants';
import { useReference } from '@/features/settings/ReferenceData';
import type { Investment } from '../schema';

export function InvestmentModal({
  open,
  investment,
  onClose,
  onSaved,
}: {
  open: boolean;
  investment: Investment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { people, currency } = useReference();
  const { toast } = useToast();
  const { run, pending, error, fields } = useAction();
  const symbol = currency === 'INR' ? '₹' : '$';

  const blank = {
    name: '',
    type: 'mutual_fund',
    person_id: '',
    invested: '',
    current_value: '',
    start_date: '',
    maturity_date: '',
    symbol: '',
    liquid: true,
    notes: '',
  };
  const [form, setForm] = useState(blank);
  const [seed, setSeed] = useState<string | null>(null);
  const key = investment?.id ?? 'new';
  if (open && seed !== key) {
    setSeed(key);
    setForm(
      investment
        ? {
            name: investment.name,
            type: investment.type,
            person_id: investment.person_id ?? '',
            invested: String(investment.invested ?? ''),
            current_value: String(investment.current_value ?? ''),
            start_date: investment.start_date?.slice(0, 10) ?? '',
            maturity_date: investment.maturity_date?.slice(0, 10) ?? '',
            symbol: investment.symbol ?? '',
            liquid: investment.liquid,
            notes: investment.notes ?? '',
          }
        : blank,
    );
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, current_value: form.current_value || form.invested };
    const saved = investment
      ? await run(() => api.patch(`/api/investments/${investment.id}`, payload))
      : await run(() => api.post('/api/investments', payload));
    if (saved) {
      toast(investment ? 'Investment updated' : 'Investment added');
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
      title={investment ? 'Edit investment' : 'Add investment'}
      description="Mutual funds, stocks, FDs, PPF, gold — yours or your parents'."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" error={fields.name}>
          <Input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Parag Parikh Flexi Cap"
            required
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => {
                const next = e.target.value;
                const meta = INVESTMENT_TYPES.find((t) => t.value === next);
                setForm((f) => ({ ...f, type: next, liquid: meta?.liquid ?? true }));
              }}
            >
              {INVESTMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner">
            <Select value={form.person_id} onChange={(e) => set('person_id', e.target.value)}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount invested" error={fields.invested}>
            <MoneyInput
              symbol={symbol}
              value={form.invested}
              onChange={(e) => set('invested', e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Current value" hint="Leave blank to match invested">
            <MoneyInput
              symbol={symbol}
              value={form.current_value}
              onChange={(e) => set('current_value', e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Started on">
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
            />
          </Field>
          <Field label="Matures on" hint="FDs, bonds, PPF">
            <Input
              type="date"
              value={form.maturity_date}
              onChange={(e) => set('maturity_date', e.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-line p-3">
          <input
            type="checkbox"
            checked={form.liquid}
            onChange={(e) => set('liquid', e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-brand)]"
          />
          <span>
            <span className="block text-[13.5px] font-medium text-ink">
              Counts towards my FIRE corpus
            </span>
            <span className="block text-[12.5px] text-ink-muted">
              Turn this off for locked-in money like PPF, EPF or the house you live in.
            </span>
          </span>
        </label>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Folio number, nominee, anything useful"
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
            {investment ? 'Save changes' : 'Add investment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
