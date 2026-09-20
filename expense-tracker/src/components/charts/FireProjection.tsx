'use client';

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART, SERIES } from '@/lib/viz';
import { compactMoney } from '@/lib/money';
import { moneyTooltip } from './tooltip';

export type ProjectionPoint = { age: number; corpus: number; target: number };

/**
 * Emphasis, not categorical: the corpus is the story and the target is the
 * baseline it has to cross, so the target is drawn as a flat grey rule.
 */
export function FireProjection({
  data,
  currency,
  crossingAge,
}: {
  data: ProjectionPoint[];
  currency: string;
  crossingAge?: number | null;
}) {
  const crossing = crossingAge ? data.find((d) => d.age >= Math.round(crossingAge)) : undefined;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: -6 }}>
        <defs>
          <linearGradient id="fire-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.2} />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="age"
          tickFormatter={(a: number) => `${a}`}
          tick={{ fill: CHART.inkMuted, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: CHART.axis }}
          minTickGap={16}
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
          content={moneyTooltip(currency, (age) => `At age ${age}`)}
        />
        <Area
          type="monotone"
          dataKey="corpus"
          name="Your corpus"
          stroke={SERIES[0]}
          strokeWidth={2}
          fill="url(#fire-grad)"
        />
        <Line
          type="monotone"
          dataKey="target"
          name="FIRE number"
          stroke={CHART.axis}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
        />
        {crossing ? (
          <ReferenceDot
            x={crossing.age}
            y={crossing.corpus}
            r={5}
            fill={SERIES[0]}
            stroke={CHART.surface}
            strokeWidth={2}
            label={{
              value: `FI at ${crossing.age}`,
              position: 'top',
              fill: CHART.ink,
              fontSize: 12,
              fontWeight: 600,
            }}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export const FIRE_LEGEND = [
  { label: 'Your corpus', color: SERIES[0] },
  { label: 'FIRE number (target)', color: CHART.axis },
];
