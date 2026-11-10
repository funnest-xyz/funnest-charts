import { areaPath, linePath, segments, type Curve, type ValueScale, type XY } from '@funnest/charts-viz';
import type { ReactNode } from 'react';
import { dashFor, DIM_OPACITY, useCartesianChart, VAR, type CartesianContextValue, type LineStyle, type ResolvedSeries } from './context';

export type AreaFill = 'gradient' | 'solid' | 'dotted' | 'none';

/** Colors above and below a `baseline` (e.g. red over the starting price, blue under it). */
export interface SplitColors {
  above: string;
  below: string;
}

/** A gradient stop for areas: `offset` 0 at the line, 1 at the baseline. */
export interface GradientStop {
  offset: number;
  opacity: number;
  color?: string;
}

/**
 * Pixel points of a series split at gaps (or joined across them with `connectNulls`).
 * `lower` is the bottom edge for stacked series and for ranges ([low, high] bands).
 */
export function seriesRuns(ctx: CartesianContextValue, s: ResolvedSeries, connectNulls = false) {
  const st = ctx.stacked?.get(s.id);
  const y = s.scale;
  const top = (i: number, v: number) => y(st ? st.y1[i]! : v);
  const bottom = (i: number) => (st ? y(st.y0[i]!) : s.low ? y(s.low[i] ?? s.data[i]!) : null);
  const runs = connectNulls
    ? [{ start: 0, values: s.data.map((v, i) => (v === null ? null : i)).filter((i): i is number => i !== null) }]
    : segments(s.data).map((r) => ({ start: r.start, values: r.values.map((_, k) => r.start + k) }));
  return runs
    .filter((r) => r.values.length > 0)
    .map((r) => {
      const idx = r.values;
      const upper: XY[] = idx.map((i) => ({ x: ctx.x(i), y: top(i, s.data[i]!) }));
      const lower = st || s.low ? idx.map((i) => ({ x: ctx.x(i), y: bottom(i)! })) : null;
      return { upper, lower };
    });
}

/** Baseline pixel: the given value, else the zero line when visible, else the plot bottom. */
function baselineY(ctx: CartesianContextValue, scale: ValueScale, baseline?: number) {
  const { top, bottom } = ctx.plot;
  if (baseline !== undefined) return Math.min(bottom, Math.max(top, scale(baseline)));
  const [d0, d1] = scale.domain;
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  return scale.kind === 'linear' && lo <= 0 && hi >= 0 ? scale(0) : bottom;
}

/** Clip rects for the part of the plot above / below a pixel y. */
function SplitClips({ id, y, ctx }: { id: string; y: number; ctx: CartesianContextValue }) {
  const { left, right, top, bottom } = ctx.plot;
  const pad = 20; // let strokes and dots near the edges through
  return (
    <defs>
      <clipPath id={`${id}-above`}>
        <rect x={left - pad} y={top - pad} width={right - left + pad * 2} height={Math.max(0, y - top + pad)} />
      </clipPath>
      <clipPath id={`${id}-below`}>
        <rect x={left - pad} y={y} width={right - left + pad * 2} height={Math.max(0, bottom - y + pad)} />
      </clipPath>
    </defs>
  );
}

export interface AreaProps {
  seriesId: string;
  curve?: Curve;
  /** 'gradient' (default), 'solid' or 'dotted' (dot pattern). */
  fill?: Exclude<AreaFill, 'none'>;
  /** Fill opacity at the line (gradient fades to 0). Default 0.24 (solid 0.16, dotted 0.5). */
  opacity?: number;
  connectNulls?: boolean;
  /** Fill toward this value instead of 0 / the plot bottom (e.g. the starting price). */
  baseline?: number;
  /** With `baseline`: color the area above / below it differently. */
  splitColors?: SplitColors;
  /** Custom gradient stops (offset 0 = line, 1 = baseline). */
  gradientStops?: readonly GradientStop[];
}

/** Filled area under a series (between stacked edges when the chart is stacked). */
export function Area({ seriesId, curve = 'monotone', fill = 'gradient', opacity, connectNulls, baseline, splitColors, gradientStops }: AreaProps) {
  const ctx = useCartesianChart();
  const s = ctx.getSeries(seriesId);
  if (!s) return null;
  const gid = `${ctx.id}-area-${s.index}`;
  const base = baselineY(ctx, s.scale, baseline);
  const alpha = opacity ?? (fill === 'gradient' ? 0.24 : fill === 'dotted' ? 0.5 : 0.16);
  const runs = seriesRuns(ctx, s, connectNulls);
  const dim = s.dimmed ? DIM_OPACITY : 1;

  /** One painted copy of the area in `color`, fading from `from` (line side) to the baseline. */
  const paint = (key: string, color: string, from: number, clip?: string) => {
    // Distinct from the split clip ids (`${gid}-above` / `-below`).
    const fillId = `${gid}-paint-${key}`;
    const stops = gradientStops ?? [
      { offset: 0, opacity: alpha },
      { offset: 1, opacity: 0 },
    ];
    return (
      <g key={key} clipPath={clip ? `url(#${clip})` : undefined} opacity={dim}>
        <defs>
          {fill === 'gradient' && (
            <linearGradient id={fillId} x1="0" y1={from} x2="0" y2={base} gradientUnits="userSpaceOnUse">
              {stops.map((st, i) => (
                <stop key={i} offset={st.offset} stopOpacity={st.opacity} style={{ stopColor: st.color ?? color }} />
              ))}
            </linearGradient>
          )}
          {fill === 'dotted' && (
            <pattern id={fillId} width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.1" style={{ fill: color }} />
            </pattern>
          )}
        </defs>
        {runs.map((run, k) => (
          <path
            key={k}
            d={areaPath(run.upper, run.lower ?? base, curve)}
            fillOpacity={fill === 'gradient' ? undefined : alpha}
            stroke="none"
            style={{ fill: fill === 'solid' ? color : `url(#${fillId})` }}
          >
            {ctx.animate && <animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze" />}
          </path>
        ))}
      </g>
    );
  };

  if (splitColors && baseline !== undefined && !run0IsStacked(ctx, s)) {
    return (
      <g>
        <SplitClips id={gid} y={base} ctx={ctx} />
        {paint('above', splitColors.above, ctx.plot.top, `${gid}-above`)}
        {paint('below', splitColors.below, ctx.plot.bottom, `${gid}-below`)}
      </g>
    );
  }
  return <g>{paint('fill', s.color, ctx.plot.top)}</g>;
}

const run0IsStacked = (ctx: CartesianContextValue, s: ResolvedSeries) => !!ctx.stacked?.get(s.id);

/** What a single point looks like; return `false`/`null` from `points` to skip one. */
export interface LinePoint {
  radius?: number;
  color?: string;
  label?: string;
  labelPosition?: 'top' | 'bottom';
}

export interface LineProps {
  seriesId: string;
  curve?: Curve;
  strokeWidth?: number;
  /** 'solid' (default), 'dashed' or 'dotted'. Falls back to the series' `lineStyle`. */
  lineStyle?: LineStyle;
  /** Custom dash pattern, e.g. "4 4" (overrides `lineStyle`). */
  dash?: string;
  /** Draw across null gaps instead of breaking. */
  connectNulls?: boolean;
  /** Also fill underneath. Default 'none'. */
  area?: AreaFill;
  areaOpacity?: number;
  opacity?: number;
  /**
   * Dots on the data points: `true` for every point, or a function returning the look of
   * point `index` (or false to skip it) — e.g. label only the high and the low.
   */
  points?: boolean | ((index: number, value: number) => LinePoint | boolean | null | undefined);
  /** Split the line (and area) color at this value, e.g. the starting price. */
  baseline?: number;
  /** With `baseline`: colors above / below it. */
  splitColors?: SplitColors;
}

export function Line({
  seriesId,
  curve = 'monotone',
  strokeWidth = 2,
  lineStyle,
  dash,
  connectNulls,
  area = 'none',
  areaOpacity,
  opacity,
  points,
  baseline,
  splitColors,
}: LineProps) {
  const ctx = useCartesianChart();
  const s = ctx.getSeries(seriesId);
  if (!s) return null;
  const style = lineStyle ?? s.lineStyle ?? 'solid';
  const dashArray = dash ?? dashFor(style, strokeWidth);
  // Draw-in: dash the whole path and slide the dash in (normalized with pathLength).
  const drawIn = ctx.animate && !dashArray;
  const runs = seriesRuns(ctx, s, connectNulls);
  const split = splitColors && baseline !== undefined;
  const gid = `${ctx.id}-line-${s.index}`;
  const baseY = baselineY(ctx, s.scale, baseline);
  const strokeOpacity = (opacity ?? 1) * (s.dimmed ? DIM_OPACITY : 1);

  const strokes = (color: string, clip?: string) => (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      {runs.map((run, k) => (
        <path
          key={k}
          d={linePath(run.upper, curve)}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashArray ?? (drawIn ? '1' : undefined)}
          strokeOpacity={strokeOpacity}
          pathLength={drawIn ? 1 : undefined}
          style={{ stroke: color }}
        >
          {drawIn && <animate attributeName="stroke-dashoffset" from="1" to="0" dur="0.8s" fill="freeze" calcMode="spline" keySplines="0.3 0 0.2 1" keyTimes="0;1" />}
        </path>
      ))}
    </g>
  );

  // Points (after the line so they sit on top).
  const dots: ReactNode[] = [];
  if (points) {
    const st = ctx.stacked?.get(s.id);
    s.data.forEach((v, i) => {
      if (v === null || v === undefined || !Number.isFinite(v)) return;
      const spec = points === true ? true : points(i, v);
      if (!spec) return;
      const p: LinePoint = spec === true ? {} : spec;
      const x = ctx.x(i);
      const y = s.scale(st ? st.y1[i]! : v);
      const color = p.color ?? (split ? (v >= baseline! ? splitColors!.above : splitColors!.below) : s.color);
      const r = p.radius ?? Math.max(3, strokeWidth + 1);
      dots.push(
        <g key={i} opacity={s.dimmed ? DIM_OPACITY : 1}>
          <circle cx={x} cy={y} r={r} strokeWidth={2} style={{ fill: color, stroke: VAR.bg }} />
          {p.label && (
            <text
              x={x}
              y={p.labelPosition === 'bottom' ? y + r + 13 : y - r - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
              style={{ fill: color, stroke: VAR.bg }}
            >
              {p.label}
            </text>
          )}
        </g>,
      );
    });
  }

  return (
    <g>
      {area !== 'none' && (
        <Area
          seriesId={seriesId}
          curve={curve}
          fill={area}
          connectNulls={connectNulls ?? false}
          {...(areaOpacity === undefined ? {} : { opacity: areaOpacity })}
          {...(baseline === undefined ? {} : { baseline })}
          {...(splitColors ? { splitColors } : {})}
        />
      )}
      {split ? (
        <>
          <SplitClips id={gid} y={baseY} ctx={ctx} />
          {strokes(splitColors!.above, `${gid}-above`)}
          {strokes(splitColors!.below, `${gid}-below`)}
        </>
      ) : (
        strokes(s.color)
      )}
      {dots}
    </g>
  );
}
