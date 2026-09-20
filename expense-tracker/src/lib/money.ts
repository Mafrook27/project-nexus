/** Money helpers. Everything in the app is stored as a plain number of rupees. */

export const DEFAULT_CURRENCY = 'INR';

const localeFor = (currency: string) => (currency === 'INR' ? 'en-IN' : 'en-US');

export function formatMoney(value: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(localeFor(currency), {
    style: 'currency',
    currency,
    maximumFractionDigits: Math.abs(n) >= 1000 || Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

/** ₹12.4L / ₹1.2Cr / ₹45.6K — for tiles and chart axes where space is tight. */
export function compactMoney(value: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
  if (currency === 'INR') {
    if (abs >= 1e7) return `${sign}${symbol}${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${sign}${symbol}${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${sign}${symbol}${trim(abs / 1e3)}K`;
    return `${sign}${symbol}${Math.round(abs)}`;
  }
  if (abs >= 1e9) return `${sign}${symbol}${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${symbol}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${symbol}${trim(abs / 1e3)}K`;
  return `${sign}${symbol}${Math.round(abs)}`;
}

function trim(n: number): string {
  return n >= 100 ? String(Math.round(n)) : n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, '');
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0));
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

/** Accepts "1,20,000", "₹1200", "1.2k" and returns a number. */
export function parseAmount(input: string): number {
  const raw = String(input).trim().toLowerCase().replace(/[₹,\s]/g, '');
  const mult = raw.endsWith('k') ? 1e3 : raw.endsWith('l') ? 1e5 : raw.endsWith('cr') ? 1e7 : 1;
  const n = parseFloat(raw.replace(/(k|l|cr)$/, ''));
  return Number.isFinite(n) ? n * mult : 0;
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
