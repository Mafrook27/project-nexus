'use client';

import { useState } from 'react';
import { Check, Clock, CreditCard, Sparkles, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAction } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';
import { NEED_COLORS, NEED_LEVELS } from '@/lib/constants';
import { PAYMENT_METHODS, TXN_SOURCES } from '@/lib/intelligence';
import { labelOf } from '@/lib/constants';
import type { Category } from '@/features/categories/schema';
import type { Transaction } from '../schema';

/**
 * One detected payment, and the two questions worth asking about it: what was
 * it, and was it worth it. Nothing here is mandatory - "Later" leaves it in the
 * queue, because a half-answered expense is worse than an unanswered one.
 */
export function ReviewCard({
  txn,
  categories,
  topCategoryIds,
  currency,
  onDone,
}: {
  txn: Transaction;
  categories: Category[];
  /** The handful offered as one-tap chips; the rest live in the dropdown. */
  topCategoryIds: string[];
  currency: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const { run, pending } = useAction();

  const [categoryId, setCategoryId] = useState(txn.category_id ?? '');
  const [needLevel, setNeedLevel] = useState<'need' | 'want' | 'waste'>(
    (txn.need_level as 'need' | 'want' | 'waste') ?? 'need',
  );
  const [reason, setReason] = useState(txn.reason ?? '');
  const [remember, setRemember] = useState(true);

  const isIncome = txn.type === 'income';
  const relevant = categories.filter((c) => c.kind === (isIncome ? 'income' : 'expense'));
  const chosen = relevant.find((c) => c.id === categoryId);

  // Chips: the usual suspects, plus whatever is already chosen so the answer is
  // never hidden behind a dropdown.
  const chipIds = new Set(isIncome ? relevant.slice(0, 6).map((c) => c.id) : topCategoryIds);
  if (categoryId) chipIds.add(categoryId);
  const chips = relevant.filter((c) => chipIds.has(c.id));
  const rest = relevant.filter((c) => !chipIds.has(c.id));

  function choose(id: string) {
    setCategoryId(id);
    const category = relevant.find((c) => c.id === id);
    if (category) setNeedLevel(category.default_need_level ?? 'need');
  }

  async function save() {
    if (!categoryId) {
      toast('Pick what this was first', 'error');
      return;
    }
    const done = await run(() =>
      api.post(`/api/transactions/${txn.id}/categorize`, {
        category_id: categoryId,
        bucket: chosen?.bucket,
        need_level: needLevel,
        reason: reason.trim() || null,
        remember: remember && Boolean(txn.merchant),
        auto_confirm: true,
      }),
    );
    if (done) {
      toast(
        remember && txn.merchant
          ? `Saved. ${txn.merchant} will be sorted automatically from now on.`
          : 'Saved',
      );
      onDone();
    }
  }

  async function later() {
    toast('Left for later');
    onDone();
  }

  async function ignore() {
    const done = await run(() =>
      api.patch(`/api/transactions/${txn.id}`, { status: 'ignored' }),
    );
    if (done) {
      toast('Ignored. It will not count towards your spending.');
      onDone();
    }
  }

  const when = txn.transaction_at
    ? new Date(txn.transaction_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  return (
    <Card className="rise">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium tracking-wide text-ink-muted uppercase">
            {isIncome ? 'Money received' : 'New spend detected'}
          </p>
          <p className="num-mono mt-1.5 text-[30px] leading-none font-semibold text-ink">
            {formatMoney(Number(txn.amount), currency)}
          </p>
          <p className="mt-1.5 text-[14px] font-medium text-ink">
            {txn.merchant ?? 'We could not tell who this was paid to'}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {when}
            </span>
            <span className="inline-flex items-center gap-1">
              <CreditCard className="size-3.5" />
              {labelOf(PAYMENT_METHODS, txn.payment_method)}
              {txn.account_last4 ? ` ····${txn.account_last4}` : ''}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Badge>{labelOf(TXN_SOURCES, txn.source)}</Badge>
          {txn.bank ? <Badge tone="brand">{txn.bank}</Badge> : null}
        </div>
      </div>

      {!txn.merchant ? (
        <p className="mt-4 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-[#7a5200]">
          The bank did not name the shop. Check your bank app if you cannot place it, and ignore it
          if it was not really a spend.
        </p>
      ) : null}

      <div className="mt-5">
        <p className="mb-2 text-[13px] font-medium text-ink-soft">
          {isIncome ? 'What was this for?' : 'What did you spend this on?'}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => {
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[13px] font-medium transition',
                  active
                    ? 'border-brand bg-brand-soft text-brand-strong'
                    : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-sunken',
                )}
              >
                <span className="size-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </button>
            );
          })}
          {rest.length ? (
            <Select
              aria-label="Another category"
              value=""
              onChange={(e) => e.target.value && choose(e.target.value)}
              className="h-9 w-auto min-w-[9rem] text-[13px]"
            >
              <option value="">Something else…</option>
              {rest.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>

      {!isIncome ? (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium text-ink-soft">Was it worth it?</p>
          <div className="grid grid-cols-3 gap-2">
            {NEED_LEVELS.map((level) => {
              const active = needLevel === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setNeedLevel(level.value)}
                  className={cn(
                    'rounded-xl border px-2 py-2 text-[13px] font-medium transition',
                    active
                      ? 'border-transparent text-white'
                      : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-sunken',
                  )}
                  style={active ? { background: NEED_COLORS[level.value] } : undefined}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="mb-2 text-[13px] font-medium text-ink-soft">
          Why? <span className="font-normal text-ink-muted">Optional</span>
        </p>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isIncome ? 'Freelance payment' : 'New headphones'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
        />
      </div>

      {txn.merchant ? (
        <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-line p-3">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-brand)]"
          />
          <span>
            <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
              <Sparkles className="size-3.5 text-brand" />
              Always sort {txn.merchant} this way
            </span>
            <span className="block text-[12.5px] text-ink-muted">
              You will not be asked about this shop again.
            </span>
          </span>
        </label>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={ignore} loading={pending}>
          <X className="size-4" /> Not a spend
        </Button>
        <Button variant="secondary" size="sm" onClick={later}>
          Later
        </Button>
        <Button size="sm" onClick={save} loading={pending}>
          <Check className="size-4" /> Save
        </Button>
      </div>
    </Card>
  );
}
