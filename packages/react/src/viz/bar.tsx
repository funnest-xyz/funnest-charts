import { barPath } from '@funnest/charts-viz';
import { useCartesianChart } from './context';

export interface BarPlotProps {
  /** Only draw these series (default: all). */
  seriesIds?: readonly string[];
  /** Corner radius at the bar's far end. Default 3. */
  radius?: number;
  /** Gap between grouped bars in one slot, px. Default 2. */
  groupGap?: number;
  /** Per-bar color (e.g. up/down volume). Return undefined to use the series color. */
  getBarColor?: (value: number, index: number, seriesId: string) => string | undefined;
  /** Dim bars other than the scrubbed one. Default true. */
  highlightScrubbed?: boolean;
}

/**
 * Bars for every series: side by side (grouped) or on top of each other when the chart
 * is `stacked`. Needs `xAxis.scaleType: 'band'` (BarChart sets it).
 */
export function BarPlot({ seriesIds, radius = 3, groupGap = 2, getBarColor, highlightScrubbed = true }: BarPlotProps) {
  const ctx = useCartesianChart();
  const band = ctx.band;
  if (!band) return null;
  const list = seriesIds ? ctx.series.filter((s) => seriesIds.includes(s.id)) : ctx.series;
  const groups = ctx.stacked ? 1 : Math.max(1, list.length);
  const barW = Math.max(1, (band.bandwidth - groupGap * (groups - 1)) / groups);
  const zero = ctx.y(Math.min(Math.max(0, Math.min(...ctx.y.domain)), Math.max(...ctx.y.domain)));
  const dim = highlightScrubbed && ctx.scrubIndex !== null;

  return (
    <g>
      {list.map((s, k) => {
        const st = ctx.stacked?.get(s.id);
        const offset = ctx.stacked ? 0 : k * (barW + groupGap);
        // Only the outermost segment of a stack gets rounded corners.
        const isTopOfStack = (i: number, v: number) =>
          !ctx.stacked || !list.slice(k + 1).some((o) => {
            const ov = o.data[i];
            return ov !== null && ov !== undefined && ov !== 0 && Math.sign(ov) === Math.sign(v);
          });
        return (
          <g key={s.id}>
            {s.data.map((v, i) => {
              if (v === null || v === undefined || !Number.isFinite(v)) return null;
              const x = band(i) + offset;
              const y0 = st ? ctx.y(st.y0[i]!) : zero;
              const y1 = st ? ctx.y(st.y1[i]!) : ctx.y(v);
              const color = getBarColor?.(v, i, s.id) ?? s.color;
              return (
                <path
                  key={i}
                  d={barPath(x, barW, y0, y1, isTopOfStack(i, v) ? radius : 0)}
                 
                  fillOpacity={dim && ctx.scrubIndex !== i ? 0.45 : 1} style={{ fill: color }}>
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
