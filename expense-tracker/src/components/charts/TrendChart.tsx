'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART, SERIES } from '@/lib/viz';
import { compactMoney } from '@/lib/money';
import { monthLabel } from '@/lib/date';
import { moneyTooltip } from './tooltip';

export type TrendPoint = {
  month: string;
  income: number;
  expense: number;
  net?: number;
};

/**
 * Two series the reader must tell apart, so this is where categorical colour
 * earns its place. Both are named in the frame's legend as well.
 */
export function TrendChart({ data, currency }: { data: TrendPoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: -6 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(m: string) => monthLabel(m)}
          tick={{ fill: CHART.inkMuted, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: CHART.axis }}
          minTickGap={14}
        />
        <YAxis
          tickFormatter={(v: number) => compactMoney(v, currency)}
          tick={{ fill: CHART.inkMuted, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={58}
        />
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
          content={moneyTooltip(currency, (m) => monthLabel(m, true))}
        />
        <Line
          type="monotone"
          dataKey="income"
          name="Income"
          stroke={SERIES[0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
        />
        <Line
          type="monotone"
          dataKey="expense"
          name="Spending"
          stroke={SERIES[1]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const TREND_LEGEND = [
  { label: 'Income', color: SERIES[0] },
  { label: 'Spending', color: SERIES[1] },
];
