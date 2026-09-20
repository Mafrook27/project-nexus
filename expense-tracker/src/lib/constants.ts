/** Shared option lists. Keep labels here so every dropdown stays consistent. */

export const BUCKETS = [
  { value: 'home', label: 'Home' },
  { value: 'personal', label: 'Personal' },
] as const;
export type Bucket = (typeof BUCKETS)[number]['value'];

export const TXN_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
] as const;
export type TxnType = (typeof TXN_TYPES)[number]['value'];

export const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Bank account' },
  { value: 'cash', label: 'Cash' },
  { value: 'wallet', label: 'Wallet / UPI' },
  { value: 'credit_card', label: 'Credit card' },
] as const;

export const RELATIONS = [
  { value: 'self', label: 'Me' },
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'family', label: 'Family (joint)' },
  { value: 'other', label: 'Other' },
] as const;

export const INVESTMENT_TYPES = [
  { value: 'mutual_fund', label: 'Mutual fund', liquid: true },
  { value: 'stock', label: 'Stock', liquid: true },
  { value: 'fd', label: 'Fixed deposit', liquid: true },
  { value: 'rd', label: 'Recurring deposit', liquid: true },
  { value: 'ppf', label: 'PPF', liquid: false },
  { value: 'epf', label: 'EPF / PF', liquid: false },
  { value: 'nps', label: 'NPS', liquid: false },
  { value: 'gold', label: 'Gold / SGB', liquid: true },
  { value: 'crypto', label: 'Crypto', liquid: true },
  { value: 'bond', label: 'Bonds', liquid: true },
  { value: 'real_estate', label: 'Real estate', liquid: false },
  { value: 'other', label: 'Other', liquid: true },
] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number]['value'];

export const LIABILITY_TYPES = [
  { value: 'loan', label: 'Loan' },
  { value: 'emi', label: 'EMI / instalment' },
  { value: 'credit_card', label: 'Credit card dues' },
  { value: 'other', label: 'Other' },
] as const;

export const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;
export type Frequency = (typeof FREQUENCIES)[number]['value'];

export const GOAL_KINDS = [
  { value: 'emergency', label: 'Emergency fund' },
  { value: 'purchase', label: 'Big purchase' },
  { value: 'education', label: 'Education' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'custom', label: 'Custom' },
] as const;

export const labelOf = (
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) => list.find((o) => o.value === value)?.label ?? value ?? '—';

/** Seeded on signup so a brand-new account is immediately usable. */
export const DEFAULT_CATEGORIES: {
  name: string;
  kind: 'expense' | 'income';
  bucket: Bucket;
  icon: string;
  color: string;
}[] = [
  { name: 'Groceries', kind: 'expense', bucket: 'home', icon: 'ShoppingCart', color: '#4C6EF5' },
  { name: 'Rent / EMI', kind: 'expense', bucket: 'home', icon: 'Home', color: '#1098AD' },
  { name: 'Utilities', kind: 'expense', bucket: 'home', icon: 'Zap', color: '#0CA678' },
  { name: 'Household help', kind: 'expense', bucket: 'home', icon: 'Users', color: '#74B816' },
  { name: 'Healthcare', kind: 'expense', bucket: 'home', icon: 'HeartPulse', color: '#E8590C' },
  { name: 'Education', kind: 'expense', bucket: 'home', icon: 'GraduationCap', color: '#9C36B5' },
  { name: 'Insurance', kind: 'expense', bucket: 'home', icon: 'ShieldCheck', color: '#3B5BDB' },
  { name: 'Food & dining', kind: 'expense', bucket: 'personal', icon: 'UtensilsCrossed', color: '#F08C00' },
  { name: 'Transport & fuel', kind: 'expense', bucket: 'personal', icon: 'Car', color: '#1C7ED6' },
  { name: 'Shopping', kind: 'expense', bucket: 'personal', icon: 'ShoppingBag', color: '#D6336C' },
  { name: 'Subscriptions', kind: 'expense', bucket: 'personal', icon: 'Repeat', color: '#7048E8' },
  { name: 'Entertainment', kind: 'expense', bucket: 'personal', icon: 'Clapperboard', color: '#F76707' },
  { name: 'Travel', kind: 'expense', bucket: 'personal', icon: 'Plane', color: '#0B7285' },
  { name: 'Personal care', kind: 'expense', bucket: 'personal', icon: 'Sparkles', color: '#C2255C' },
  { name: 'Gifts & donations', kind: 'expense', bucket: 'personal', icon: 'Gift', color: '#AE3EC9' },
  { name: 'Misc', kind: 'expense', bucket: 'personal', icon: 'CircleDashed', color: '#868E96' },
  { name: 'Salary', kind: 'income', bucket: 'personal', icon: 'Wallet', color: '#2F9E44' },
  { name: 'Business / freelance', kind: 'income', bucket: 'personal', icon: 'Briefcase', color: '#37B24D' },
  { name: 'Interest & dividend', kind: 'income', bucket: 'personal', icon: 'PiggyBank', color: '#66A80F' },
  { name: 'Rental income', kind: 'income', bucket: 'home', icon: 'Building2', color: '#5C940D' },
  { name: 'Other income', kind: 'income', bucket: 'personal', icon: 'Plus', color: '#099268' },
];
