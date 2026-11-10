import { barPath } from '@funnest/charts-viz';
import { DIM_OPACITY, useCartesianChart } from './context';

export interface BarPlotProps {
  /** Only draw these series (default: all). */
  seriesIds?: readonly string[];
  /** Corner radius at the bar's far end. Default 3. */
  radius?: number;
  /** Also round the baseline end (pill-shaped bars). Default false. */
  roundBaseline?: boolean;
  /** Gap between grouped bars in one slot, px. Default 2. */
  groupGap?: number;
  /** Gap between stacked segments, px. Default 0. */
  stackGap?: number;
  /** Smallest drawn bar length for non-zero values, px (tiny values stay visible). Default 0. */
  minSize?: number;
  /** Per-bar color (e.g. up/down volume). Return undefined to use the series color. */
  getBarColor?: (value: number, index: number, seriesId: string) => string | undefined;
  /** Dim bars other than the scrubbed one. Default true. */
  highlightScrubbed?: boolean;
}

/**
 * Bars for every series: side by side (grouped) or on top of each other when the chart
 * is `stacked`. Needs `xAxis.scaleType: 'band'` (BarChart sets it).
 */
export function BarPlot({
  seriesIds,
  radius = 3,
  roundBaseline = false,
  groupGap = 2,
  stackGap = 0,
  minSize = 0,
  getBarColor,
  highlightScrubbed = true,
}: BarPlotProps) {
  const ctx = useCartesianChart();
  const band = ctx.band;
  if (!band) return null;
  const list = seriesIds ? ctx.series.filter((s) => seriesIds.includes(s.id)) : ctx.series;
  const groups = ctx.stacked ? 1 : Math.max(1, list.length);
  const barW = Math.max(1, (band.bandwidth - groupGap * (groups - 1)) / groups);
  // Each series draws against its own y axis.
  const zeroOf = (scale: typeof ctx.y) => {
    const [d0, d1] = scale.domain;
    return scale(Math.min(Math.max(0, Math.min(d0, d1)), Math.max(d0, d1)));
  };
  const dim = highlightScrubbed && ctx.scrubIndex !== null;

  return (
    <g>
      {list.map((s, k) => {
        const st = ctx.stacked?.get(s.id);
        const y = s.scale;
        const zero = zeroOf(y);
        const offset = ctx.stacked ? 0 : k * (barW + groupGap);
        // Only the outermost segment of a stack gets rounded corners.
        const isTopOfStack = (i: number, v: number) =>
          !ctx.stacked ||
          !list.slice(k + 1).some((o) => {
            const ov = o.data[i];
            return ov !== null && ov !== undefined && ov !== 0 && Math.sign(ov) === Math.sign(v);
          });
        return (
          <g key={s.id} opacity={s.dimmed ? DIM_OPACITY : 1}>
            {s.data.map((v, i) => {
              if (v === null || v === undefined || !Number.isFinite(v) || v === 0) return null;
              const x = band(i) + offset;
              // Ranges ([low, high]) float between their ends; others grow from zero.
              const low = s.low?.[i];
              let y0 = st ? y(st.y0[i]!) : low !== null && low !== undefined && s.low ? y(low) : zero;
              let y1 = st ? y(st.y1[i]!) : y(v);
              const dir = Math.sign(y1 - y0) || -1;
              const top = isTopOfStack(i, v);
              const atBase = Math.abs(y0 - zero) <= 0.5 || !!s.low;
              // Stack gaps: pull each segment in at the joins (never at the zero line).
              if (st && stackGap > 0) {
                if (!atBase) y0 += (dir * stackGap) / 2;
                if (!top) y1 -= (dir * stackGap) / 2;
              }
              if (minSize > 0 && Math.abs(y1 - y0) < minSize) y1 = y0 + dir * minSize;
              const color = getBarColor?.(v, i, s.id) ?? s.color;
              // With gaps every segment reads as its own piece, so its far end gets a small radius.
              const r = top ? radius : st && stackGap > 0 ? Math.min(radius, 2) : 0;
              return (
                <path
                  key={i}
                  d={barPath(x, barW, y0, y1, s.low ? radius : r, (roundBaseline && atBase) || !!s.low)}
                  fillOpacity={dim && ctx.scrubIndex !== i ? 0.45 : 1}
                  style={{ fill: color }}
                >
                  {ctx.animate && <animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze" />}
                </path>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
