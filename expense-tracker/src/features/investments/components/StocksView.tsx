'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { CandlestickChart, FileSpreadsheet, Upload } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/StatTile';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { TableWrap, Td, Th } from '@/components/ui/Table';
import { EmptyState, ErrorNote } from '@/components/ui/States';
import { StocksSkeleton } from '@/components/skeletons/PageSkeletons';
import { useToast } from '@/components/ui/Toast';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { RankedBars } from '@/components/charts/RankedBars';
import { useAction, useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney, formatNumber, formatPercent } from '@/lib/money';
import { SERIES, foldTail } from '@/lib/viz';
import { useReference } from '@/features/settings/ReferenceData';
import { COLUMN_HINTS, guessColumn, parseCsvAmount } from '@/features/import/csv';
import type { Investment } from '../schema';

type Row = Record<string, string>;

export function StocksView() {
  const { people, currency } = useReference();
  const { data, error, loading, reload } = useResource<Investment[]>('/api/investments');
  const [importing, setImporting] = useState(false);

  const holdings = useMemo(
    () => (data ?? []).filter((i) => i.type === 'stock'),
    [data],
  );

  const invested = holdings.reduce((s, h) => s + Number(h.invested), 0);
  const current = holdings.reduce((s, h) => s + Number(h.current_value), 0);
  const pnl = current - invested;

  const withPnl = holdings
    .map((h) => {
      const gain = Number(h.current_value) - Number(h.invested);
      return {
        ...h,
        gain,
        gainPct: Number(h.invested) > 0 ? (gain / Number(h.invested)) * 100 : 0,
        weight: current > 0 ? (Number(h.current_value) / current) * 100 : 0,
      };
    })
    .sort((a, b) => b.gainPct - a.gainPct);

  // With only a handful of holdings the "best" and "worst" lists would name the
  // same stocks twice, so the laggards list never repeats a gainer.
  const gainers = withPnl.slice(0, 3);
  const laggards = withPnl
    .slice()
    .reverse()
    .filter((h) => !gainers.some((g) => g.id === h.id))
    .slice(0, 3);

  const allocation = foldTail(
    holdings.map((h) => ({ name: h.symbol ?? h.name, value: Number(h.current_value) })),
  );
  const biggest = withPnl.slice().sort((a, b) => b.weight - a.weight)[0];

  if (loading && !data) return <StocksSkeleton />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Stocks</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Upload the holdings file from your broker and it draws itself.
          </p>
        </div>
        <Button size="sm" onClick={() => setImporting(true)}>
          <Upload className="size-4" /> Upload holdings CSV
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Invested" value={formatMoney(invested, currency)} />
        <StatTile
          label="Current value"
          value={formatMoney(current, currency)}
          accent={SERIES[0]}
        />
        <StatTile
          label="Profit on paper"
          value={formatMoney(pnl, currency)}
          delta={invested > 0 ? (pnl / invested) * 100 : null}
          sub="if you sold today"
          accent={pnl >= 0 ? SERIES[2] : SERIES[1]}
        />
        <StatTile
          label="Holdings"
          value={String(holdings.length)}
          sub={
            biggest
              ? `${biggest.symbol ?? biggest.name} is ${biggest.weight.toFixed(0)}% of the book`
              : 'Nothing yet'
          }
        />
      </div>

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {holdings.length ? (
        <>
          {biggest && biggest.weight > 25 ? (
            <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-[#7a5200]">
              <span className="font-medium">Concentration check.</span> {biggest.symbol ?? biggest.name}{' '}
              is {biggest.weight.toFixed(0)}% of this portfolio. A single stock above a quarter of
              the book makes your returns mostly that one company&apos;s story.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame
              title="How it is split"
              height="h-auto"
            >
              <RankedBars rows={allocation} currency={currency} />
            </ChartFrame>

            <Card>
              <CardHeader title="Best and worst" />
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[12.5px] font-medium tracking-wide text-ink-muted uppercase">
                    Top gainers
                  </p>
                  <ul className="space-y-2">
                    {gainers.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="truncate font-medium">{h.symbol ?? h.name}</span>
                        <span className="num-mono shrink-0 font-medium text-good-ink">
                          +{formatPercent(h.gainPct)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {laggards.length ? (
                  <div className="border-t border-line pt-3">
                    <p className="mb-2 text-[12.5px] font-medium tracking-wide text-ink-muted uppercase">
                      Biggest laggards
                    </p>
                    <ul className="space-y-2">
                      {laggards.map((h) => (
                        <li
                          key={h.id}
                          className="flex items-center justify-between gap-3 text-[13px]"
                        >
                          <span className="truncate font-medium">{h.symbol ?? h.name}</span>
                          <span
                            className={`num-mono shrink-0 font-medium ${h.gainPct >= 0 ? 'text-good-ink' : 'text-bad'}`}
                          >
                            {h.gainPct >= 0 ? '+' : ''}
                            {formatPercent(h.gainPct)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Your stocks" subtitle={`${holdings.length} in total`} />
            <TableWrap>
              <thead>
                <tr>
                  <Th>Symbol</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Avg cost</Th>
                  <Th align="right">Last price</Th>
                  <Th align="right">Value</Th>
                  <Th align="right">P&L</Th>
                  <Th align="right">Weight</Th>
                </tr>
              </thead>
              <tbody>
                {withPnl.map((h) => (
                  <tr key={h.id}>
                    <Td>
                      <span className="block font-medium text-ink">{h.symbol ?? h.name}</span>
                      {h.person_name ? (
                        <span className="text-[12px] text-ink-muted">{h.person_name}</span>
                      ) : null}
                    </Td>
                    <Td align="right">{formatNumber(Number(h.units ?? 0), 2)}</Td>
                    <Td align="right">{formatMoney(Number(h.avg_price ?? 0), currency)}</Td>
                    <Td align="right">{formatMoney(Number(h.last_price ?? 0), currency)}</Td>
                    <Td align="right">{formatMoney(Number(h.current_value), currency)}</Td>
                    <Td align="right">
                      <span className={h.gain >= 0 ? 'text-good-ink' : 'text-bad'}>
                        {h.gain >= 0 ? '+' : ''}
                        {formatMoney(h.gain, currency)}
                        <span className="ml-1 text-[12px] opacity-80">
                          ({formatPercent(h.gainPct)})
                        </span>
                      </span>
                    </Td>
                    <Td align="right">{h.weight.toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        </>
      ) : data ? (
        <Card>
          <EmptyState
            icon={<CandlestickChart className="size-5" />}
            title="No stock holdings yet"
            description="Export holdings from Zerodha, Groww, Upstox or any broker as CSV and upload it here. Re-upload any time to refresh prices."
            action={
              <Button size="sm" onClick={() => setImporting(true)}>
                <Upload className="size-4" /> Upload holdings CSV
              </Button>
            }
          />
        </Card>
      ) : null}

      <HoldingsImport
        open={importing}
        people={people}
        currency={currency}
        onClose={() => setImporting(false)}
        onDone={() => {
          void reload();
          setImporting(false);
        }}
      />
    </div>
  );
}

function HoldingsImport({
  open,
  people,
  currency,
  onClose,
  onDone,
}: {
  open: boolean;
  people: { id: string; name: string }[];
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const { run, pending, error } = useAction();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [personId, setPersonId] = useState('');
  const [replace, setReplace] = useState(false);
  const [map, setMap] = useState({ symbol: '', quantity: '', avgPrice: '', lastPrice: '' });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = (result.meta.fields ?? []).filter(Boolean);
        setHeaders(cols);
        setRows(result.data);
        setMap({
          symbol: guessColumn(cols, [...COLUMN_HINTS.symbol]),
          quantity: guessColumn(cols, [...COLUMN_HINTS.quantity]),
          avgPrice: guessColumn(cols, [...COLUMN_HINTS.avgPrice]),
          lastPrice: guessColumn(cols, [...COLUMN_HINTS.lastPrice]),
        });
      },
    });
  }

  const parsed = rows
    .map((r) => {
      const symbol = (r[map.symbol] ?? '').trim();
      const units = parseCsvAmount(r[map.quantity] ?? '');
      const avg = parseCsvAmount(r[map.avgPrice] ?? '');
      const last = map.lastPrice ? parseCsvAmount(r[map.lastPrice] ?? '') : null;
      if (!symbol || !units || units <= 0 || avg === null) return null;
      return { symbol, units, avg_price: avg, last_price: last ?? undefined };
    })
    .filter(Boolean) as { symbol: string; units: number; avg_price: number; last_price?: number }[];

  async function submit() {
    const result = await run(() =>
      api.post<{ inserted: number; updated: number }>('/api/investments/import', {
        person_id: personId,
        replace,
        rows: parsed,
      }),
    );
    if (result) {
      toast(`${result.inserted} added, ${result.updated} refreshed`);
      setHeaders([]);
      setRows([]);
      onDone();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Upload holdings"
      description="Matching happens on the symbol, so re-uploading just refreshes prices."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending} disabled={!parsed.length}>
            Import {parsed.length ? `${parsed.length} holdings` : ''}
          </Button>
        </>
      }
    >
      {!headers.length ? (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong px-6 py-12 text-center transition hover:border-brand hover:bg-brand-soft/40">
          <span className="grid size-11 place-items-center rounded-xl bg-surface-sunken text-ink-muted">
            <Upload className="size-5" />
          </span>
          <span className="text-sm font-medium text-ink">Choose your holdings CSV</span>
          <span className="max-w-sm text-[12.5px] text-ink-muted">
            Needs a symbol, a quantity and an average cost. A last-traded price column is used for
            live value if present.
          </span>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-[13px]">
              <FileSpreadsheet className="size-4 shrink-0 text-ink-muted" />
              <span className="truncate font-medium">{fileName}</span>
              <span className="shrink-0 text-ink-muted">{rows.length} rows</span>
            </span>
            <button
              onClick={() => setHeaders([])}
              className="text-[12.5px] font-medium text-brand hover:underline"
            >
              Choose another
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['symbol', 'Symbol column'],
                ['quantity', 'Quantity column'],
                ['avgPrice', 'Average cost column'],
                ['lastPrice', 'Last price column (optional)'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Select
                  value={map[key]}
                  onChange={(e) => setMap((m) => ({ ...m, [key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
            <Field label="Demat account owner">
              <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-line p-3">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-brand)]"
            />
            <span>
              <span className="block text-[13.5px] font-medium text-ink">
                Replace my existing stock list
              </span>
              <span className="block text-[12.5px] text-ink-muted">
                Deletes stocks that are not in this file. Use it when you have sold something.
              </span>
            </span>
          </label>

          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">
              Preview — {parsed.length} of {rows.length} rows are usable
            </p>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Symbol</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Avg cost</Th>
                  <Th align="right">Value</Th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 6).map((r) => (
                  <tr key={r.symbol}>
                    <Td>{r.symbol}</Td>
                    <Td align="right">{formatNumber(r.units, 2)}</Td>
                    <Td align="right">{formatMoney(r.avg_price, currency)}</Td>
                    <Td align="right">
                      {formatMoney(r.units * (r.last_price ?? r.avg_price), currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>

          {error ? (
            <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
