import {
  BarChart3,
  Inbox,
  CalendarClock,
  Calculator,
  CandlestickChart,
  Flag,
  Flame,
  LayoutDashboard,
  Landmark,
  Receipt,
  Settings,
  Target,
  TrendingUp,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  short?: string;
  /** Names a live counter the shell renders beside the label. */
  badge?: 'review';
};

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, short: 'Home' },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Every month',
    items: [
      { href: '/transactions', label: 'Money in & out', icon: Receipt, short: 'Money' },
      { href: '/review', label: 'Needs a look', icon: Inbox, short: 'Review', badge: 'review' },
      { href: '/budgets', label: 'Budgets', icon: Target },
      { href: '/bills', label: 'Bills & loans', icon: CalendarClock, short: 'Bills' },
    ],
  },
  {
    title: 'What you own',
    items: [
      { href: '/accounts', label: 'Accounts', icon: Landmark },
      { href: '/investments', label: 'Investments', icon: TrendingUp, short: 'Invest' },
      { href: '/stocks', label: 'Stocks', icon: CandlestickChart },
    ],
  },
  {
    title: 'Long term',
    items: [
      { href: '/fire', label: 'Financial freedom', icon: Flame, short: 'Freedom' },
      { href: '/goals', label: 'Goals', icon: Flag },
      { href: '/calculators', label: 'Calculators', icon: Calculator, short: 'Calc' },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: '/settings', label: 'Settings', icon: Settings };

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

/** The four that fit a phone's bottom bar, found by href so the order of the
 *  sidebar can change without silently repointing them. */
const byHref = (href: string) => ALL_NAV.find((i) => i.href === href)!;
export const MOBILE_NAV = [
  byHref('/dashboard'),
  byHref('/transactions'),
  byHref('/review'),
  byHref('/fire'),
];
