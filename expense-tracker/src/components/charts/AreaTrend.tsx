'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART, SERIES } from '@/lib/viz';
import { compactMoney } from '@/lib/money';
import { monthLabel } from '@/lib/date';
import { moneyTooltip, percentTooltip } from './tooltip';

/** A single series over time: one hue, no legend needed - the title names it. */
export function AreaTrend({
  data,
  dataKey,
  name,
  currency,
  color = SERIES[0],
  xKey = 'month',
  formatX,
  unit = 'money',
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  name: string;
  currency: string;
  color?: string;
  xKey?: string;
  formatX?: (v: string) => string;
  /** Percentage series need a % axis and tooltip, not a currency one. */
  unit?: 'money' | 'percent';
}) {
  const fx = formatX ?? ((v: string) => monthLabel(v));
  const gradientId = `grad-${dataKey}`;
  const isPercent = unit === 'percent';
  const formatValue = (v: number) => (isPercent ? `${Math.round(v)}%` : compactMoney(v, currency));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: -6 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tickFormatter={fx}
          tick={{ fill: CHART.inkMuted, fontSize: 11, fontFamily: 'var(--font-plex-mono)' }}
          tickLine={false}
          axisLine={{ stroke: CHART.axis }}
          minTickGap={14}
        />
        <YAxis
          tickFormatter={formatValue}
          tick={{ fill: CHART.inkMuted, fontSize: 11, fontFamily: 'var(--font-plex-mono)' }}
          tickLine={false}
          axisLine={false}
          width={isPercent ? 44 : 58}
        />
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
          content={
            isPercent ? percentTooltip((v) => fx(v)) : moneyTooltip(currency, (v) => fx(v))
          }
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
