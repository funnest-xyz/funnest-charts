/** One numeric series. `data[i]` lines up with x position i (null = gap). */
export interface SeriesData {
  id: string;
  data: readonly (number | null)[];
}

const isNum = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

/** Min/max over the non-null values of every series (null when there is none). */
export function extent(series: readonly SeriesData[]): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const v of s.data) {
      if (!isNum(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return min === Infinity ? null : [min, max];
}

/** Longest series length. */
export const maxLength = (series: readonly SeriesData[]) => series.reduce((m, s) => Math.max(m, s.data.length), 0);

export interface StackedSeries {
  id: string;
  /** Lower edge per index (the sum of the series below). */
  y0: number[];
  /** Upper edge per index. */
  y1: number[];
}

/**
 * Stack series on top of each other. Positive values stack upward from 0, negative values
 * downward, so mixed-sign data (P&L by strategy, inflow/outflow) stays readable.
 */
export function stack(series: readonly SeriesData[]): StackedSeries[] {
  const n = maxLength(series);
  const pos = new Array<number>(n).fill(0);
  const neg = new Array<number>(n).fill(0);
  return series.map((s) => {
    const y0: number[] = [];
    const y1: number[] = [];
    for (let i = 0; i < n; i++) {
      const raw = s.data[i];
      const v = isNum(raw) ? raw : 0;
      const base = v >= 0 ? pos : neg;
      y0.push(base[i]!);
      base[i] = base[i]! + v;
      y1.push(base[i]!);
    }
    return { id: s.id, y0, y1 };
  });
}

/** [min, max] of stacked series (always includes 0). */
export function stackedExtent(stacked: readonly StackedSeries[]): [number, number] {
  let min = 0;
  let max = 0;
  for (const s of stacked) {
    for (let i = 0; i < s.y1.length; i++) {
      min = Math.min(min, s.y0[i]!, s.y1[i]!);
      max = Math.max(max, s.y0[i]!, s.y1[i]!);
    }
  }
  return [min, max];
}

export interface PercentageSegment {
  id: string;
  value: number;
  /** Share of the total, 0–1. */
  fraction: number;
  /** Cumulative start, 0–1. */
  start: number;
}

/** Split a whole into shares (negative values count as 0). */
export function percentages(items: readonly { id: string; value: number }[]): PercentageSegment[] {
  const total = items.reduce((t, i) => t + Math.max(0, i.value), 0);
  let start = 0;
  return items.map((i) => {
    const fraction = total > 0 ? Math.max(0, i.value) / total : 0;
    const seg = { id: i.id, value: i.value, fraction, start };
    start += fraction;
    return seg;
  });
}

/** Index of the x position nearest to `pixel`, given each index's pixel x (sorted ascending). */
export function nearestIndex(xs: readonly number[], pixel: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! <= pixel) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[hi]! - pixel) < Math.abs(xs[lo]! - pixel) ? hi : lo;
}

/**
 * Change from the first non-null value to the last non-null value at or before `end`
 * (for "+12.3% this month" headers; pass the scrubbed index as `end`).
 */
export function seriesChange(data: readonly (number | null)[], end = data.length - 1) {
  let first: number | null = null;
  for (const v of data) {
    if (isNum(v)) {
      first = v;
      break;
    }
  }
  let last: number | null = null;
  for (let i = Math.min(end, data.length - 1); i >= 0; i--) {
    const v = data[i];
    if (isNum(v)) {
      last = v;
      break;
    }
  }
  if (first === null || last === null) return null;
  const change = last - first;
  return { first, last, change, percent: first === 0 ? 0 : (change / Math.abs(first)) * 100 };
}
