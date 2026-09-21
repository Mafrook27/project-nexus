'use client';

import { useState } from 'react';
import { CalendarDays, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/StatTile';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import { EmptyState, ErrorNote } from '@/components/ui/States';
import { SipSkeleton } from '@/components/skeletons/PageSkeletons';
import { useToast } from '@/components/ui/Toast';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { GrowthChart, GROWTH_LEGEND } from '@/components/charts/GrowthChart';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { toISODate } from '@/lib/date';
import { sipSeries } from '@/features/calculators/math';
import { useReference } from '@/features/settings/ReferenceData';
import type { Sip } from '../schema';

/** Live SIPs plus what they are projected to become. */
export function SipSection({ currency }: { currency: string }) {
  const { people, refresh } = useReference();
  const { toast } = useToast();
  const { run } = useAction();
  const { data, error, loading, reload } = useResource<Sip[]>('/api/sips');
  const [editing, setEditing] = useState<Sip | null>(null);
  const [adding, setAdding] = useState(false);

  const sips = data ?? [];
  const active = sips.filter((s) => s.active);
  const monthly = active.reduce((sum, s) => sum + Number(s.amount), 0);
  const blendedReturn =
    monthly > 0
      ? active.reduce((sum, s) => sum + Number(s.expected_return) * Number(s.amount), 0) / monthly
      : 12;
  const avgStepUp =
    monthly > 0
      ? active.reduce((sum, s) => sum + Number(s.step_up_pct) * Number(s.amount), 0) / monthly
      : 0;

  const projection = sipSeries(monthly, blendedReturn, 20, avgStepUp).map((p) => ({
    year: p.year,
    invested: p.invested,
    gain: p.gain,
  }));
  const twenty = projection.at(-1);

  async function toggle(sip: Sip) {
    const done = await run(() => api.patch(`/api/sips/${sip.id}`, { active: !sip.active }));
    if (done) {
      toast(sip.active ? 'SIP paused' : 'SIP resumed');
      void reload();
    }
  }

  async function remove(sip: Sip) {
    if (!confirm(`Delete the SIP "${sip.name}"?`)) return;
    const done = await run(() => api.del(`/api/sips/${sip.id}`));
    if (done) {
      toast('SIP deleted');
      void reload();
    }
  }

  if (loading && !data) return <SipSkeleton />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Every month"
          value={formatMoney(monthly, currency)}
          sub={`${active.length} active`}
          icon={<Repeat className="size-4" />}
        />
        <StatTile
          label="Average return"
          value={`${blendedReturn.toFixed(1)}%`}
          sub="Across your SIPs"
        />
        <StatTile
          label="In 20 years"
          value={formatMoney((twenty?.invested ?? 0) + (twenty?.gain ?? 0), currency)}
          sub={`${formatMoney(twenty?.gain ?? 0, currency)} of it is growth`}
        />
      </div>

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {monthly > 0 ? (
        <ChartFrame
          title="Where these end up"
          subtitle={`${formatMoney(monthly, currency)} a month at ${blendedReturn.toFixed(1)}%${avgStepUp > 0 ? `, stepped up ${avgStepUp.toFixed(0)}% a year` : ''}`}
          legend={GROWTH_LEGEND}
          height="h-[260px]"
        >
          <GrowthChart data={projection} currency={currency} />
        </ChartFrame>
      ) : null}

      <Card>
        <CardHeader
          title="Your SIPs"
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add SIP
            </Button>
          }
        />
        {sips.length ? (
          <ul className="divide-y divide-line">
            {sips.map((s) => (
              <li key={s.id} className="group flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                  <CalendarDays className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{s.name}</p>
                  <p className="truncate text-[12px] text-ink-muted">
                    Day {s.day_of_month} · {Number(s.expected_return).toFixed(1)}% expected
                    {Number(s.step_up_pct) > 0 ? ` · +${Number(s.step_up_pct)}% yearly` : ''}
                    {s.person_name ? ` · ${s.person_name}` : ''}
                  </p>
                </div>
                {!s.active ? <Badge>Paused</Badge> : null}
                <span className="num-mono shrink-0 text-[14px] font-semibold">
                  {formatMoney(Number(s.amount), currency)}
                </span>
                <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    onClick={() => toggle(s)}
                    aria-label={s.active ? 'Pause SIP' : 'Resume SIP'}
                    className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  >
                    {s.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </button>
                  <button
                    onClick={() => setEditing(s)}
                    aria-label="Edit SIP"
                    className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => remove(s)}
                    aria-label="Delete SIP"
                    className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Repeat className="size-5" />}
            title="No SIPs yet"
            description="Add your monthly instalments to see what they become in 10 or 20 years."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Add SIP
              </Button>
            }
          />
        )}
      </Card>

      <SipModal
        open={adding || Boolean(editing)}
        sip={editing}
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

function SipModal({
  open,
  sip,
  people,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  sip: Sip | null;
  people: { id: string; name: string }[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { run, pending, error, fields } = useAction();
  const blank = {
    name: '',
    amount: '',
    person_id: '',
    day_of_month: '1',
    expected_return: '12',
    step_up_pct: '0',
    start_date: toISODate(),
    active: true,
  };
  const [form, setForm] = useState(blank);
  const [seed, setSeed] = useState<string | null>(null);
  const key = sip?.id ?? 'new';
  if (open && seed !== key) {
    setSeed(key);
    setForm(
      sip
        ? {
            name: sip.name,
            amount: String(sip.amount),
            person_id: sip.person_id ?? '',
            day_of_month: String(sip.day_of_month),
            expected_return: String(sip.expected_return),
            step_up_pct: String(sip.step_up_pct),
            start_date: sip.start_date.slice(0, 10),
            active: sip.active,
          }
        : blank,
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const saved = sip
      ? await run(() => api.patch(`/api/sips/${sip.id}`, form))
      : await run(() => api.post('/api/sips', form));
    if (saved) {
      toast(sip ? 'SIP updated' : 'SIP added');
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
      title={sip ? 'Edit SIP' : 'Add SIP'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Fund or plan name" error={fields.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nifty 50 Index Fund"
            required
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly amount" error={fields.amount}>
            <MoneyInput
              symbol={currency === 'INR' ? '₹' : '$'}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </Field>
          <Field label="Debit day">
            <Input
              type="number"
              min={1}
              max={28}
              value={form.day_of_month}
              onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expected return %" hint="Long-term average">
            <Input
              type="number"
              step="0.5"
              value={form.expected_return}
              onChange={(e) => setForm((f) => ({ ...f, expected_return: e.target.value }))}
            />
          </Field>
          <Field label="Yearly step-up %" hint="Raise the SIP each year">
            <Input
              type="number"
              step="1"
              value={form.step_up_pct}
              onChange={(e) => setForm((f) => ({ ...f, step_up_pct: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Started on">
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </Field>
          <Field label="Investor">
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

        {error ? (
          <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {sip ? 'Save changes' : 'Add SIP'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
