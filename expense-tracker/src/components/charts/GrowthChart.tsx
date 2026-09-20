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
import { moneyTooltip } from './tooltip';

export type GrowthPoint = { year: number; invested: number; gain: number };

/**
 * What you put in versus what compounding added, stacked so the total height is
 * the corpus. A 2px surface gap keeps the two fills from blending.
 */
export function GrowthChart({ data, currency }: { data: GrowthPoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: -6 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="year"
          tickFormatter={(y: number) => `${y}y`}
          tick={{ fill: CHART.inkMuted, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: CHART.axis }}
          minTickGap={12}
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
          content={moneyTooltip(currency, (y) => `After ${y} year${y === '1' ? '' : 's'}`)}
        />
        <Area
          type="monotone"
          stackId="corpus"
          dataKey="invested"
          name="You invested"
          stroke={SERIES[0]}
          strokeWidth={2}
          fill={SERIES[0]}
          fillOpacity={0.18}
        />
        <Area
          type="monotone"
          stackId="corpus"
          dataKey="gain"
          name="Returns earned"
          stroke={SERIES[2]}
          strokeWidth={2}
          fill={SERIES[2]}
          fillOpacity={0.18}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const GROWTH_LEGEND = [
  { label: 'You invested', color: SERIES[0] },
  { label: 'Returns earned', color: SERIES[2] },
];
