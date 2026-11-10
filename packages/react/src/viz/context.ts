import type { BandScale, StackedSeries, ValueScale } from '@funnest/charts-viz';
import { createContext, useContext } from 'react';

export interface ChartSeries {
  id: string;
  /** Values per x position; null = gap. */
  data: readonly (number | null)[];
  label?: string;
  /** Any CSS color. Defaults to the palette. */
  color?: string;
  /** Line style for this series (overrides the chart's). */
  lineStyle?: LineStyle;
  /** Area fill for this series in AreaChart / LineChart `area` (overrides the chart's). */
  areaStyle?: 'gradient' | 'solid' | 'dotted' | 'none';
}

export type LineStyle = 'solid' | 'dashed' | 'dotted';

/** A series with its resolved color. */
export interface ResolvedSeries extends ChartSeries {
  color: string;
  index: number;
  /** Another series is emphasized (legend hover): draw this one faded. */
  dimmed: boolean;
}

export interface PlotRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface CartesianContextValue {
  /** Unique per chart, for SVG ids (gradients, clip paths). */
  id: string;
  width: number;
  height: number;
  plot: PlotRect;
  series: ResolvedSeries[];
  getSeries(id: string): ResolvedSeries | undefined;
  /** Number of x positions. */
  length: number;
  /** Pixel x of x position `i` (band center for bar charts). */
  x(i: number): number;
  /** Set when the x axis is categorical (bar charts). */
  band: BandScale | null;
  /** Value scale (linear or log). */
  y: ValueScale;
  /** Stacked edges per series id when `stacked`. */
  stacked: Map<string, StackedSeries> | null;
  /** Label for x position `i` (from `xAxis.data`, else the index). */
  xLabel(i: number): string;
  xData: readonly (string | number)[] | undefined;
  /** Index under the pointer (or chosen with the arrow keys), or null. */
  scrubIndex: number | null;
  /** The chart has keyboard focus (scrubbing with arrow keys). */
  focused: boolean;
  animate: boolean;
}

export const CartesianContext = createContext<CartesianContextValue | null>(null);

export function useCartesianChart(): CartesianContextValue {
  const ctx = useContext(CartesianContext);
  if (!ctx) throw new Error('Funnest chart components must be rendered inside <CartesianChart> (or LineChart, AreaChart, BarChart).');
  return ctx;
}

/**
 * Visual tokens. Override with CSS variables on any ancestor. The fallbacks use the CSS
 * system colors (Canvas / CanvasText), so charts follow the page's light/dark
 * `color-scheme` with no setup.
 */
export const VAR = {
  text: 'var(--fnv-text-muted, color-mix(in srgb, CanvasText 50%, Canvas))',
  textStrong: 'var(--fnv-text, CanvasText)',
  grid: 'var(--fnv-grid, color-mix(in srgb, CanvasText 9%, transparent))',
  line: 'var(--fnv-line, color-mix(in srgb, CanvasText 32%, transparent))',
  bg: 'var(--fnv-bg, Canvas)',
  font: 'var(--fnv-font, inherit)',
  accentRing: 'color-mix(in srgb, var(--fnv-accent, #6C4DFF) 55%, transparent)',
} as const;

/** Opacity for series faded by legend emphasis. */
export const DIM_OPACITY = 0.22;

/** Stroke dash pattern for a line style (dotted uses round caps on zero-length dashes). */
export const dashFor = (style: LineStyle | undefined, width: number): string | undefined =>
  style === 'dashed' ? `${width * 3} ${width * 2.5}` : style === 'dotted' ? `0.1 ${width * 2.6}` : undefined;

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 });

/** Default number display: full digits up to 100k, compact (1.2M, 34만) beyond. */
export const formatNumber = (v: number) => (Math.abs(v) >= 1e5 ? compactFormat.format(v) : numberFormat.format(v));

/** Pixel y of series `s` at index `i` (top edge when stacked), or null for a gap. */
export function seriesY(ctx: CartesianContextValue, s: ResolvedSeries, i: number): number | null {
  const stacked = ctx.stacked?.get(s.id);
  if (stacked) {
    const raw = s.data[i];
    return raw === null || raw === undefined ? null : ctx.y(stacked.y1[i]!);
  }
  const v = s.data[i];
  return v === null || v === undefined || !Number.isFinite(v) ? null : ctx.y(v);
}
