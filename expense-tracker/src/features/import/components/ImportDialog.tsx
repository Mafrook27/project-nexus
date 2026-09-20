'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Td, TableWrap, Th } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useAction } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { useReference } from '@/features/settings/ReferenceData';
import { COLUMN_HINTS, guessColumn, normaliseDate, parseCsvAmount } from '../csv';

type Row = Record<string, string>;
type Mapping = { date: string; amount: string; credit: string; description: string; category: string };

/**
 * Bank statement -> transactions. The file is parsed in the browser; only the
 * mapped rows are sent to the server.
 */
export function ImportDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { accounts, people, currency } = useReference();
  const { toast } = useToast();
  const { run, pending, error } = useAction();

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [map, setMap] = useState<Mapping>({
    date: '',
    amount: '',
    credit: '',
    description: '',
    category: '',
  });
  const [bucket, setBucket] = useState<'home' | 'personal'>('personal');
  const [accountId, setAccountId] = useState('');
  const [personId, setPersonId] = useState('');

  function reset() {
    setHeaders([]);
    setRows([]);
    setFileName('');
  }

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
          date: guessColumn(cols, [...COLUMN_HINTS.date]),
          amount: guessColumn(cols, [...COLUMN_HINTS.amount]),
          credit: guessColumn(cols, [...COLUMN_HINTS.credit]),
          description: guessColumn(cols, [...COLUMN_HINTS.description]),
          category: guessColumn(cols, [...COLUMN_HINTS.category]),
        });
      },
    });
  }

  const parsed = rows
    .map((row) => {
      const date = normaliseDate(row[map.date] ?? '');
      const debit = parseCsvAmount(row[map.amount] ?? '');
      const credit = map.credit ? parseCsvAmount(row[map.credit] ?? '') : null;
      const amount = credit && credit > 0 ? credit : debit;
      if (!date || amount === null || amount === 0) return null;
      const isIncome = Boolean(credit && credit > 0) || (debit !== null && debit > 0 && !map.amount);
      return {
        txn_date: date,
        amount: Math.abs(amount),
        type: (credit && credit > 0 ? 'income' : 'expense') as 'income' | 'expense',
        bucket,
        merchant: (row[map.description] ?? '').slice(0, 120) || undefined,
        category: map.category ? (row[map.category] ?? '').slice(0, 60) || undefined : undefined,
      };
    })
    .filter(Boolean) as {
    txn_date: string;
    amount: number;
    type: 'income' | 'expense';
    bucket: 'home' | 'personal';
    merchant?: string;
    category?: string;
  }[];

  async function submit() {
    const result = await run(() =>
      api.post<{ created: number; categoriesCreated: number }>('/api/transactions/import', {
        account_id: accountId,
        person_id: personId,
        rows: parsed,
      }),
    );
    if (result) {
      toast(`Imported ${result.created} transactions`);
      reset();
      onDone();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Import from CSV"
      description="Works with most bank and credit-card statement exports."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending} disabled={!parsed.length}>
            Import {parsed.length ? `${parsed.length} rows` : ''}
          </Button>
        </>
      }
    >
      {!headers.length ? (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong px-6 py-12 text-center transition hover:border-brand hover:bg-brand-soft/40">
          <span className="grid size-11 place-items-center rounded-xl bg-surface-sunken text-ink-muted">
            <Upload className="size-5" />
          </span>
          <span className="text-sm font-medium text-ink">Choose a CSV file</span>
          <span className="max-w-sm text-[12.5px] text-ink-muted">
            Export your statement as CSV from net banking. Dates like 14/03/2026 and amounts like
            ₹1,240.50 are understood.
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
            <button onClick={reset} className="text-[12.5px] font-medium text-brand hover:underline">
              Choose another
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['date', 'Date column'],
                ['amount', 'Amount / debit column'],
                ['credit', 'Credit column (optional)'],
                ['description', 'Description column'],
                ['category', 'Category column (optional)'],
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
            <Field label="Into account">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Not tracked</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Whose spending">
              <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Treat these as">
              <Segmented
                value={bucket}
                onChange={setBucket}
                options={[
                  { value: 'home' as const, label: 'Home' },
                  { value: 'personal' as const, label: 'Personal' },
                ]}
                className="h-10 w-full [&>button]:flex-1"
              />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">
              Preview — {parsed.length} of {rows.length} rows are usable
            </p>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Category</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 6).map((r, i) => (
                  <tr key={i}>
                    <Td>{r.txn_date}</Td>
                    <Td className="max-w-[220px] truncate">{r.merchant ?? '—'}</Td>
                    <Td>{r.category ?? '—'}</Td>
                    <Td align="right">
                      {r.type === 'income' ? '+' : '−'}
                      {formatMoney(r.amount, currency)}
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
