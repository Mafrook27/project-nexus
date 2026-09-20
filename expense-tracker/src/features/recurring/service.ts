import { toISODate } from '@/lib/date';

/** Rolls a due date forward by one period. */
export function advanceDueDate(current: string, frequency: string): string {
  const d = new Date(`${String(current).slice(0, 10)}T00:00:00`);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return toISODate(d);
}

/** Normalises any frequency to a per-month figure for budgeting. */
export function monthlyEquivalent(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}
