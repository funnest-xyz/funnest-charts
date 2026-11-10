import { bandScale, barPath, extent, linearScale, seriesColor, stack, stackedExtent, ticks as niceTicks } from '@funnest/charts-viz';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { DIM_OPACITY, formatNumber, VAR, type ChartSeries } from './context';
import { Legend, type LegendShape } from './legend';

export interface HorizontalBarChartProps {
  series: readonly ChartSeries[];
  /** Category labels, one per row (top to bottom). */
  categories?: readonly string[];
  width?: number;
  /** Default: 34px per row plus the axis. */
  height?: number;
  stacked?: boolean;
  /** Corner radius at the bar's far end. Default 3. */
  radius?: number;
  /** Gap between grouped bars in one row, px. Default 2. */
  groupGap?: number;
  /** Gap between stacked segments, px. Default 0. */
  stackGap?: number;
  /** Band padding between rows, 0–0.95. Default 0.3. */
  bandPadding?: number;
  getBarColor?: (value: number, index: number, seriesId: string) => string | undefined;
  /** Value axis along the bottom. Default true. */
  showValueAxis?: boolean;
  /** Category labels on the left. Default true. */
  showCategoryAxis?: boolean;
  valueFormatter?: (value: number) => string;
  /** Highlight the hovered row and show its values. Default true. */
  enableScrubbing?: boolean;
  legend?: boolean | { shape?: LegendShape };
  palette?: readonly string[];
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

const textWidth = (t: string, size = 12) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? size : size * 0.6), 0);

/** Bars running left → right, one row per category: rankings, holdings, sector P&L. */
export function HorizontalBarChart({
  series,
  categories,
  width: fixedWidth,
  height,
  stacked = false,
  radius = 3,
  groupGap = 2,
  stackGap = 0,
  bandPadding = 0.3,
  getBarColor,
  showValueAxis = true,
  showCategoryAxis = true,
  valueFormatter = formatNumber,
  enableScrubbing = true,
  legend = false,
  palette,
  className,
  style,
  'aria-label': ariaLabel,
}: HorizontalBarChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(fixedWidth ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (fixedWidth !== undefined) return setMeasured(fixedWidth);
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && setMeasured(Math.round(e.contentRect.width)));
    ro.observe(el);
    setMeasured(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [fixedWidth]);

  const resolved = useMemo(
    () =>
      series.map((s, index) => ({
        ...s,
        color: s.color ?? seriesColor(index, palette),
        high: s.data.map((v) => (Array.isArray(v) ? Math.max(v[0], v[1]) : (v as number | null))),
        low: s.data.some((v) => Array.isArray(v)) ? s.data.map((v) => (Array.isArray(v) ? Math.min(v[0], v[1]) : (v as number | null))) : null,
      })),
    [series, palette],
  );
  const rows = Math.max(categories?.length ?? 0, ...resolved.map((s) => s.high.length));
  const h = height ?? rows * 34 + (showValueAxis ? 26 : 8);
  const w = measured;

  const labelW = showCategoryAxis ? Math.min(140, Math.max(0, ...(categories ?? []).map((c) => textWidth(c))) + 12) : 0;
  const left = labelW + 4;
  const right = Math.max(left + 10, w - 12);
  const top = 4;
  const bottom = h - (showValueAxis ? 24 : 4);

  const stackedMap = stacked ? new Map(stack(resolved.map((s) => ({ id: s.id, data: s.high }))).map((st) => [st.id, st])) : null;
  let [min, max] = stacked
    ? stackedExtent([...stackedMap!.values()])
    : (extent([...resolved.map((s) => ({ id: s.id, data: s.high })), ...resolved.flatMap((s) => (s.low ? [{ id: `${s.id}~`, data: s.low }] : []))]) ?? [0, 1]);
  min = Math.min(min, 0);
  max = Math.max(max, 0);
  const xs = linearScale([min, max], [left, right]);
  const band = bandScale(rows, [top, bottom], bandPadding);
  const zero = xs(0);
  const groups = stacked ? 1 : Math.max(1, resolved.length);
  const barH = Math.max(1, (band.bandwidth - groupGap * (groups - 1)) / groups);
  const tickValues = niceTicks(min, max, Math.max(2, Math.floor((right - left) / 80)));

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(band.invert(e.clientY - r.top));
  };

  // Keyboard: ↑↓ move between rows, Home/End, Esc clears.
  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    const last = rows - 1;
    if (last < 0) return;
    let next: number | null | undefined;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = hover === null ? 0 : Math.min(last, hover + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = hover === null ? last : Math.max(0, hover - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') next = null;
    if (next === undefined) return;
    e.preventDefault();
    setHover(next);
  };

  // Tooltip for the hovered row.
  const tipRows =
    hover === null
      ? []
      : resolved.flatMap((s) => {
          const v = s.high[hover];
          if (v === null || v === undefined) return [];
          const lo = s.low?.[hover];
          return [{ s, color: getBarColor?.(v, hover, s.id) ?? s.color, text: lo !== null && lo !== undefined && lo !== v ? `${valueFormatter(lo)} – ${valueFormatter(v)}` : valueFormatter(v) }];
        });
  const tipW = Math.max(0, ...tipRows.map((r) => textWidth(r.text) + textWidth(r.s.label ?? r.s.id) + 30)) + 8;
  const tipH = tipRows.length * 18 + 14;
  const rowY = hover === null ? 0 : band.center(hover);
  const tipY = Math.min(Math.max(top, rowY - tipH / 2), bottom - tipH);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', width: fixedWidth ?? '100%', fontFamily: VAR.font, ...style }}>
      {legend && (
        <Legend
          {...(typeof legend === 'object' && legend.shape ? { shape: legend.shape } : {})}
          items={resolved.map((s) => ({ id: s.id, label: s.label ?? s.id, color: s.color }))}
        />
      )}
      <svg
        width={w || '100%'}
        height={h}
        role="img"
        aria-label={ariaLabel}
        tabIndex={enableScrubbing ? 0 : undefined}
        style={{ display: 'block', overflow: 'visible', userSelect: 'none', outline: 'none', borderRadius: 6, boxShadow: focused ? `0 0 0 2px ${VAR.accentRing}` : undefined }}
        onPointerMove={enableScrubbing ? onMove : undefined}
        onPointerLeave={enableScrubbing ? () => !focused && setHover(null) : undefined}
        onKeyDown={enableScrubbing ? onKeyDown : undefined}
        onFocus={enableScrubbing ? () => setFocused(true) : undefined}
        onBlur={
          enableScrubbing
            ? () => {
                setFocused(false);
                setHover(null);
              }
            : undefined
        }
      >
        {w > 0 && (
          <>
            {tickValues.map((t) => (
              <line key={`g${t}`} x1={xs(t)} x2={xs(t)} y1={top} y2={bottom} shapeRendering="crispEdges" style={{ stroke: VAR.grid }} />
            ))}
            {min < 0 && <line x1={zero} x2={zero} y1={top} y2={bottom} shapeRendering="crispEdges" style={{ stroke: VAR.line }} />}
            {hover !== null && <rect x={left - 4} y={band.center(hover) - band.step / 2} width={right - left + 8} height={band.step} rx={6} style={{ fill: VAR.grid }} />}
            {resolved.map((s, k) => {
              const st = stackedMap?.get(s.id);
              return (
                <g key={s.id}>
                  {s.high.map((v, i) => {
                    if (v === null || v === undefined || !Number.isFinite(v) || v === 0) return null;
                    const yTop = band(i) + (stacked ? 0 : k * (barH + groupGap));
                    const lo = s.low?.[i];
                    let x0 = st ? xs(st.y0[i]!) : lo !== null && lo !== undefined && s.low ? xs(lo) : zero;
                    let x1 = st ? xs(st.y1[i]!) : xs(v);
                    const isTop = !stacked || !resolved.slice(k + 1).some((o) => (o.high[i] ?? 0) !== 0 && Math.sign(o.high[i]!) === Math.sign(v));
                    const dir = Math.sign(x1 - x0) || 1;
                    if (st && stackGap > 0) {
                      if (Math.abs(x0 - zero) > 0.5) x0 += (dir * stackGap) / 2;
                      if (!isTop) x1 -= (dir * stackGap) / 2;
                    }
                    const color = getBarColor?.(v, i, s.id) ?? s.color;
                    // Draw as a vertical bar in a rotated frame: barPath rounds the far end.
                    const d = barPath(yTop, barH, x0, x1, isTop || s.low ? radius : 0, !!s.low);
                    return (
                      <path
                        key={i}
                        d={d}
                        transform={`matrix(0 1 1 0 0 0)`}
                        opacity={hover !== null && hover !== i ? DIM_OPACITY * 2 : 1}
                        style={{ fill: color }}
                      />
                    );
                  })}
                </g>
              );
            })}
            {showCategoryAxis &&
              (categories ?? []).map((c, i) => (
                <text key={c + i} x={labelW} y={band.center(i)} textAnchor="end" dominantBaseline="central" fontSize={12} style={{ fill: hover === i ? VAR.textStrong : VAR.text, fontWeight: hover === i ? 700 : 500 }}>
                  {c}
                </text>
              ))}
            {showValueAxis &&
              tickValues.map((t) => (
                <text key={t} x={xs(t)} y={h - 6} textAnchor="middle" fontSize={11} style={{ fill: VAR.text }}>
                  {valueFormatter(t)}
                </text>
              ))}
            {tipRows.length > 0 && (
              <g transform={`translate(${Math.min(right - tipW, Math.max(left, xs(max) - tipW))},${tipY})`} pointerEvents="none">
                <rect width={tipW} height={tipH} rx={8} strokeWidth={1} style={{ fill: VAR.bg, stroke: VAR.grid }} />
                {tipRows.map((r, k) => (
                  <g key={r.s.id} transform={`translate(10,${7 + 9 + k * 18})`}>
                    <circle cx={3} cy={0} r={3} style={{ fill: r.color }} />
                    <text x={12} dominantBaseline="central" fontSize={12} style={{ fill: VAR.text }}>
                      {r.s.label ?? r.s.id}
                    </text>
                    <text x={tipW - 20} textAnchor="end" dominantBaseline="central" fontSize={12} fontWeight={700} style={{ fill: VAR.textStrong, fontVariantNumeric: 'tabular-nums' }}>
                      {r.text}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </>
        )}
      </svg>
      {enableScrubbing && (
        <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {focused && hover !== null ? [categories?.[hover] ?? String(hover), ...tipRows.map((r) => `${r.s.label ?? r.s.id} ${r.text}`)].join(', ') : ''}
        </span>
      )}
    </div>
  );
}
