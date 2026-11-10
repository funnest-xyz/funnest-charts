import { areaPath, linePath, segments, type Curve, type XY } from '@funnest/charts-viz';
import { useCartesianChart, type CartesianContextValue, type ResolvedSeries } from './context';

export type AreaFill = 'gradient' | 'solid' | 'none';

/** Pixel points of a series split at gaps (or joined across them with `connectNulls`). */
export function seriesRuns(ctx: CartesianContextValue, s: ResolvedSeries, connectNulls = false) {
  const st = ctx.stacked?.get(s.id);
  const top = (i: number, v: number) => ctx.y(st ? st.y1[i]! : v);
  const bottom = (i: number) => (st ? ctx.y(st.y0[i]!) : null);
  const runs = connectNulls
    ? [{ start: 0, values: s.data.map((v, i) => (v === null ? null : i)).filter((i): i is number => i !== null) }]
    : segments(s.data).map((r) => ({ start: r.start, values: r.values.map((_, k) => r.start + k) }));
  return runs
    .filter((r) => r.values.length > 0)
    .map((r) => {
      const idx = r.values;
      const upper: XY[] = idx.map((i) => ({ x: ctx.x(i), y: top(i, s.data[i]!) }));
      const lower = st ? idx.map((i) => ({ x: ctx.x(i), y: bottom(i)! })) : null;
      return { upper, lower };
    });
}

/** Baseline pixel for unstacked areas: the zero line when visible, else the plot bottom. */
function baselineY(ctx: CartesianContextValue) {
  const [d0, d1] = ctx.y.domain;
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  return lo <= 0 && hi >= 0 ? ctx.y(0) : ctx.plot.bottom;
}

export interface AreaProps {
  seriesId: string;
  curve?: Curve;
  fill?: Exclude<AreaFill, 'none'>;
  /** Fill opacity at the line (gradient fades to 0). Default 0.24 (solid 0.16). */
  opacity?: number;
  connectNulls?: boolean;
}

/** Filled area under a series (between stacked edges when the chart is stacked). */
export function Area({ seriesId, curve = 'monotone', fill = 'gradient', opacity, connectNulls }: AreaProps) {
  const ctx = useCartesianChart();
  const s = ctx.getSeries(seriesId);
  if (!s) return null;
  const gid = `${ctx.id}-area-${s.index}`;
  const base = baselineY(ctx);
  const alpha = opacity ?? (fill === 'gradient' ? 0.24 : 0.16);
  return (
    <g>
      {fill === 'gradient' && (
        <defs>
          <linearGradient id={gid} x1="0" y1={ctx.plot.top} x2="0" y2={base} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopOpacity={alpha} style={{ stopColor: s.color }} />
            <stop offset="1" stopOpacity={0} style={{ stopColor: s.color }} />
          </linearGradient>
        </defs>
      )}
      {seriesRuns(ctx, s, connectNulls).map((run, k) => (
        <path
          key={k}
          d={areaPath(run.upper, run.lower ?? base, curve)}
         
          fillOpacity={fill === 'solid' ? alpha : undefined}
          stroke="none" style={{ fill: fill === 'gradient' ? `url(#${gid})` : s.color }}>
          {ctx.animate && <animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze" />}
        </path>
      ))}
    </g>
  );
}

export interface LineProps {
  seriesId: string;
  curve?: Curve;
  strokeWidth?: number;
  /** Dashed line, e.g. "4 4". */
  dash?: string;
  /** Draw across null gaps instead of breaking. */
  connectNulls?: boolean;
  /** Also fill underneath. Default 'none'. */
  area?: AreaFill;
  areaOpacity?: number;
  opacity?: number;
}

export function Line({
  seriesId,
  curve = 'monotone',
  strokeWidth = 2,
  dash,
  connectNulls,
  area = 'none',
  areaOpacity,
  opacity,
}: LineProps) {
  const ctx = useCartesianChart();
  const s = ctx.getSeries(seriesId);
  if (!s) return null;
  // Draw-in: dash the whole path and slide the dash in (normalized with pathLength).
  const drawIn = ctx.animate && !dash;
  return (
    <g>
      {area !== 'none' && (
        <Area seriesId={seriesId} curve={curve} fill={area} connectNulls={connectNulls ?? false} {...(areaOpacity === undefined ? {} : { opacity: areaOpacity })} />
      )}
      {seriesRuns(ctx, s, connectNulls).map((run, k) => (
        <path
          key={k}
          d={linePath(run.upper, curve)}
          fill="none"
         
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dash ?? (drawIn ? '1' : undefined)}
          strokeOpacity={opacity}
          pathLength={drawIn ? 1 : undefined} style={{ stroke: s.color }}>
          {drawIn && <animate attributeName="stroke-dashoffset" from="1" to="0" dur="0.8s" fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1" />}
        </path>
      ))}
    </g>
  );
}
