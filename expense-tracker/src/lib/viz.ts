/**
 * Chart tokens. These hexes are a validated set - adjacent pairs clear the
 * colour-vision-deficiency separation floor on a white surface. Do not add a
 * ninth series colour: fold the tail into "Other" instead.
 */

/** Categorical - only when series identity is the point. Never cycled. */
export const SERIES = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const;

/** Sequential blue, darkest = largest. Used for ranked magnitude bars. */
export const SEQUENTIAL = [
  '#184f95',
  '#1c5cab',
  '#256abf',
  '#2a78d6',
  '#3987e5',
  '#5598e7',
  '#6da7ec',
  '#86b6ef',
] as const;

export const CHART = {
  surface: '#ffffff',
  grid: '#E8EAED',
  axis: '#C3C2BF',
  ink: '#0B0B0B',
  inkMuted: '#898781',
  other: '#B9BEC7',
} as const;

export const STATUS = {
  good: '#0CA30C',
  warning: '#FAB219',
  serious: '#EC835A',
  critical: '#D03B3B',
  goodText: '#006300',
} as const;

/** Ranked colours for a magnitude bar chart (index 0 = biggest). */
export const rankColor = (index: number): string =>
  SEQUENTIAL[Math.min(index, SEQUENTIAL.length - 1)];

/**
 * Keeps a chart inside the eight-slot ceiling: top N by value, the rest folded
 * into a single grey "Other" row.
 */
export function foldTail<T extends { name: string; value: number }>(
  rows: T[],
  keep = 7,
): { name: string; value: number; color: string }[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, keep).map((r, i) => ({
    name: r.name,
    value: r.value,
    color: rankColor(i),
  }));
  const tail = sorted.slice(keep);
  if (tail.length) {
    head.push({
      name: `Other (${tail.length})`,
      value: tail.reduce((s, r) => s + r.value, 0),
      color: CHART.other,
    });
  }
  return head;
}
