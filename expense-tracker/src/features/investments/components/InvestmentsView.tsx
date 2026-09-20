'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Pencil, Plus, TrendingUp, Trash2, Wallet } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/StatTile';
import { Segmented } from '@/components/ui/Segmented';
import { TableWrap, Td, Th } from '@/components/ui/Table';
import { EmptyState, ErrorNote, LoadingCard } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { RankedBars } from '@/components/charts/RankedBars';
import { ShareBar } from '@/components/charts/ShareBar';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney, formatPercent } from '@/lib/money';
import { formatDate } from '@/lib/date';
import { INVESTMENT_TYPES, labelOf } from '@/lib/constants';
import { SERIES, foldTail } from '@/lib/viz';
import { useReference } from '@/features/settings/ReferenceData';
import { InvestmentModal } from './InvestmentModal';
import { SipSection } from '@/features/sips/components/SipSection';
import type { Investment } from '../schema';

export function InvestmentsView() {
  const { people, currency } = useReference();
  const { toast } = useToast();
  const { run } = useAction();
  const { data, error, loading, reload } = useResource<Investment[]>('/api/investments');

  const [tab, setTab] = useState<'holdings' | 'sips'>('holdings');
  const [owner, setOwner] = useState('all');
  const [editing, setEditing] = useState<Investment | null>(null);
  const [adding, setAdding] = useState(false);

  const all = useMemo(() => data ?? [], [data]);
  const rows = owner === 'all' ? all : all.filter((i) => (i.person_id ?? 'none') === owner);

  const invested = rows.reduce((s, i) => s + Number(i.invested), 0);
  const current = rows.reduce((s, i) => s + Number(i.current_value), 0);
  const gain = current - invested;
  const liquid = rows.filter((i) => i.liquid).reduce((s, i) => s + Number(i.current_value), 0);

  const byType = foldTail(
    Object.values(
      rows.reduce<Record<string, { name: string; value: number }>>((acc, i) => {
        const label = labelOf(INVESTMENT_TYPES, i.type);
        acc[label] = { name: label, value: (acc[label]?.value ?? 0) + Number(i.current_value) };
        return acc;
      }, {}),
    ),
  );

  const byPerson = useMemo(() => {
    const groups = new Map<string, { current: number; invested: number }>();
    for (const i of all) {
      const name = i.person_name ?? 'Unassigned';
      const row = groups.get(name) ?? { current: 0, invested: 0 };
      row.current += Number(i.current_value);
      row.invested += Number(i.invested);
      groups.set(name, row);
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].current - a[1].current)
      .slice(0, 6)
      .map(([label, row], idx) => ({
        label,
        value: row.current,
        invested: row.invested,
        gain: row.current - row.invested,
        color: SERIES[idx],
      }));
  }, [all]);

  const ownerOptions = [
    { value: 'all', label: 'Everyone' },
    ...people.map((p) => ({ value: p.id, label: p.name })),
  ];

  async function remove(investment: Investment) {
    if (!confirm(`Delete "${investment.name}"?`)) return;
    const done = await run(() => api.del(`/api/investments/${investment.id}`));
    if (done) {
      toast('Investment removed');
      void reload();
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Investments</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Everything the family owns, in one place — yours, your mother&apos;s and your
            father&apos;s.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/stocks">
            <Button variant="secondary" size="sm">
              Import stocks CSV
            </Button>
          </Link>
          <a href="/api/export?type=investments" download>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> Export
            </Button>
          </a>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Invested" value={formatMoney(invested, currency)} icon={<Wallet className="size-4" />} />
        <StatTile
          label="Current value"
          value={formatMoney(current, currency)}
          icon={<TrendingUp className="size-4" />}
          accent={SERIES[0]}
        />
        <StatTile
          label="Total gain"
          value={formatMoney(gain, currency)}
          delta={invested > 0 ? (gain / invested) * 100 : null}
          sub="since you started"
          accent={gain >= 0 ? SERIES[2] : SERIES[1]}
        />
        <StatTile
          label="FIRE corpus"
          value={formatMoney(liquid, currency)}
          sub="Liquid holdings only"
          accent={SERIES[6]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'holdings' as const, label: 'Holdings' },
            { value: 'sips' as const, label: 'SIPs' },
          ]}
        />
        {tab === 'holdings' ? (
          <Segmented value={owner} onChange={setOwner} options={ownerOptions} size="sm" />
        ) : null}
      </div>

      {tab === 'sips' ? (
        <SipSection currency={currency} />
      ) : (
        <>
          {error ? <ErrorNote message={error} onRetry={reload} /> : null}
          {loading && !data ? <LoadingCard height="h-72" /> : null}

          {data && rows.length ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartFrame
                  title="Allocation by asset type"
                  subtitle="Current value"
                  height="h-auto"
                >
                  <RankedBars rows={byType} currency={currency} />
                </ChartFrame>
                <Card>
                  <CardHeader title="Split by owner" subtitle="Across the whole family" />
                  <ShareBar parts={byPerson} currency={currency} />
                  <TableWrap className="mt-5 border-t border-line pt-4">
                    <thead>
                      <tr>
                        <Th>Owner</Th>
                        <Th align="right">Invested</Th>
                        <Th align="right">Value</Th>
                        <Th align="right">Gain</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {byPerson.map((p) => (
                        <tr key={p.label}>
                          <Td>
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ background: p.color }}
                              />
                              {p.label}
                            </span>
                          </Td>
                          <Td align="right">{formatMoney(p.invested, currency)}</Td>
                          <Td align="right">{formatMoney(p.value, currency)}</Td>
                          <Td align="right">
                            <span
                              className={
                                p.gain >= 0 ? 'font-medium text-good-ink' : 'font-medium text-bad'
                              }
                            >
                              {p.gain >= 0 ? '+' : ''}
                              {formatMoney(p.gain, currency)}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </Card>
              </div>

              <Card>
                <CardHeader title="Holdings" subtitle={`${rows.length} entries`} />
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Type</Th>
                      <Th>Owner</Th>
                      <Th align="right">Invested</Th>
                      <Th align="right">Value</Th>
                      <Th align="right">Return</Th>
                      <Th align="right"> </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => {
                      const g = Number(i.current_value) - Number(i.invested);
                      const pct = Number(i.invested) > 0 ? (g / Number(i.invested)) * 100 : 0;
                      return (
                        <tr key={i.id} className="group">
                          <Td>
                            <span className="block font-medium text-ink">{i.name}</span>
                            {i.start_date ? (
                              <span className="text-[12px] text-ink-muted">
                                since {formatDate(i.start_date)}
                              </span>
                            ) : null}
                          </Td>
                          <Td>
                            <span className="text-[13px] text-ink-soft">
                              {labelOf(INVESTMENT_TYPES, i.type)}
                            </span>
                            {!i.liquid ? (
                              <Badge className="ml-1.5" tone="neutral">
                                Locked
                              </Badge>
                            ) : null}
                          </Td>
                          <Td>
                            <span className="text-[13px] text-ink-soft">
                              {i.person_name ?? '—'}
                            </span>
                          </Td>
                          <Td align="right">{formatMoney(Number(i.invested), currency)}</Td>
                          <Td align="right">{formatMoney(Number(i.current_value), currency)}</Td>
                          <Td align="right">
                            <span
                              className={
                                g >= 0 ? 'font-medium text-good-ink' : 'font-medium text-bad'
                              }
                            >
                              {g >= 0 ? '+' : ''}
                              {formatPercent(pct)}
                            </span>
                          </Td>
                          <Td align="right">
                            <span className="flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                              <button
                                onClick={() => setEditing(i)}
                                aria-label="Edit"
                                className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => remove(i)}
                                aria-label="Delete"
                                className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrap>
              </Card>
            </>
          ) : data ? (
            <Card>
              <EmptyState
                icon={<TrendingUp className="size-5" />}
                title="No investments recorded"
                description="Add a mutual fund, an FD or your parents' holdings to start tracking the family's wealth."
                action={
                  <Button size="sm" onClick={() => setAdding(true)}>
                    <Plus className="size-4" /> Add investment
                  </Button>
                }
              />
            </Card>
          ) : null}
        </>
      )}

      <InvestmentModal
        open={adding || Boolean(editing)}
        investment={editing}
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
