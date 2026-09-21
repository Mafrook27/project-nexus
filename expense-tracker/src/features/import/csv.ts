/** CSV helpers shared by the transaction importer and the stock importer. */

/** Normalises the date formats Indian banks and brokers actually export. */
export function normaliseDate(input: string): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // 2026-03-14 or 2026/03/14
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;

  // 14-03-2026, 14/03/2026, 14.03.2026  (day first - the Indian default)
  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${pad(dmy[2])}-${pad(dmy[1])}`;
  }

  // 14 Mar 2026 / 14-Mar-26
  const named = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})$/);
  if (named) {
    const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    if (month > 0) {
      const year = named[3].length === 2 ? `20${named[3]}` : named[3];
      return `${year}-${pad(String(month))}-${pad(named[1])}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(String(parsed.getMonth() + 1))}-${pad(String(parsed.getDate()))}`;
  }
  return null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (v: string) => String(v).padStart(2, '0');

/** Strips currency symbols, thousands separators and (brackets) for negatives. */
export function parseCsvAmount(input: string): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || raw.includes('-');
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Scores each header against a list of likely names so mapping starts correct. */
export function guessColumn(headers: string[], candidates: string[]): string {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const exact = lower.findIndex((h) => h === candidate);
    if (exact >= 0) return headers[exact];
  }
  for (const candidate of candidates) {
    const partial = lower.findIndex((h) => h.includes(candidate));
    if (partial >= 0) return headers[partial];
  }
  return '';
}

export const COLUMN_HINTS = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posted'],
  amount: ['amount', 'debit', 'value', 'withdrawal', 'money out', 'total'],
  credit: ['credit', 'deposit', 'money in'],
  description: ['description', 'narration', 'particulars', 'merchant', 'details', 'remarks', 'name'],
  category: ['category', 'tag', 'type of expense'],
  symbol: ['symbol', 'ticker', 'instrument', 'scrip', 'stock'],
  quantity: ['quantity', 'qty', 'units', 'shares', 'holding'],
  avgPrice: ['average price', 'avg price', 'avg cost', 'buy price', 'cost price', 'avg'],
  lastPrice: ['last price', 'ltp', 'current price', 'market price', 'close', 'nav'],
} as const;
