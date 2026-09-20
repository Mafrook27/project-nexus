import {
  BarChart3,
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
    title: 'Spending',
    items: [
      { href: '/transactions', label: 'Transactions', icon: Receipt, short: 'Spends' },
      { href: '/budgets', label: 'Budgets', icon: Target },
      { href: '/bills', label: 'Bills & EMIs', icon: CalendarClock, short: 'Bills' },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/accounts', label: 'Accounts', icon: Landmark },
      { href: '/investments', label: 'Investments', icon: TrendingUp, short: 'Invest' },
      { href: '/stocks', label: 'Stocks', icon: CandlestickChart },
    ],
  },
  {
    title: 'Future',
    items: [
      { href: '/fire', label: 'FIRE', icon: Flame },
      { href: '/goals', label: 'Goals', icon: Flag },
      { href: '/calculators', label: 'Calculators', icon: Calculator, short: 'Calc' },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: '/settings', label: 'Settings', icon: Settings };

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

/** The five that fit a phone's bottom bar. */
export const MOBILE_NAV = [
  ALL_NAV[0], // dashboard
  ALL_NAV[2], // transactions
  ALL_NAV[6], // investments
  ALL_NAV[8], // fire
];
