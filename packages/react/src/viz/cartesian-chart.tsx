import {
  bandScale,
  extent,
  linearScale,
  logScale,
  maxLength,
  nearestIndex,
  niceDomain,
  seriesColor,
  stack,
  stackedExtent,
  type StackedSeries,
} from '@funnest/charts-viz';
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { CartesianContext, formatNumber, VAR, type CartesianContextValue, type ChartSeries, type PlotRect, type ResolvedSeries } from './context';
import { Legend, type LegendPosition, type LegendShape } from './legend';

export type Inset = number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;

export interface XAxisConfig {
  /** Labels or timestamps per x position (for axis labels, scrubber and legend). */
  data?: readonly (string | number)[];
  /** 'band' gives each x position a slot (bar charts); 'linear' spreads points edge to edge. */
  scaleType?: 'linear' | 'band';
  /** Band padding between bars, 0–0.95. Default 0.25. */
  bandPadding?: number;
}

export interface YAxisConfig {
  /** Fix either end of the value range; the other end follows the data. */
  domain?: { min?: number; max?: number };
  /** Always include 0 (default for bar charts). */
  includeZero?: boolean;
  /** Round the range outward to nice numbers. Default false (use the data range). */
  nice?: boolean;
  /** 'log' for values spanning orders of magnitude (needs positive values). Default 'linear'. */
  scaleType?: 'linear' | 'log';
}

export interface LegendConfig {
  /** Default 'top'. */
  position?: LegendPosition;
  /** Hover an item to emphasize its series, click to hide/show it. Default false. */
  interactive?: boolean;
  shape?: LegendShape;
}

export interface CartesianChartProps {
  series: readonly ChartSeries[];
  /** Pixel width. Omit to fill the parent (measured with ResizeObserver). */
  width?: number;
  /** Pixel height of the drawing area. Default 240. */
  height?: number;
  /** Space between the SVG edge and the plot (axes add their own space). Default 8. */
  inset?: Inset;
  xAxis?: XAxisConfig;
  yAxis?: YAxisConfig;
  /** Stack the series (areas / bars). */
  stacked?: boolean;
  /**
   * Track the pointer and expose the hovered index to <Scrubber>, legends and headers.
   * Also makes the chart focusable: ← → (Shift for 10 steps), Home / End, Esc.
   */
  enableScrubbing?: boolean;
  onScrubberPositionChange?: (index: number | null) => void;
  /** Screen-reader text for the scrubbed position. Default: the x label and each series value. */
  getScrubberAccessibilityLabel?: (index: number) => string;
  /** Draw-in animation on mount. Default true (off when the user prefers reduced motion). */
  animate?: boolean;
  /** Series legend outside the plot. */
  legend?: boolean | LegendPosition | LegendConfig;
  /** Format legend values while scrubbing. */
  legendValueFormatter?: (value: number, seriesId: string) => string;
  /** Shown instead of the plot when no series has a value. */
  emptyState?: ReactNode;
  /** Override the categorical palette. */
  palette?: readonly string[];
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  children?: ReactNode;
}

const DEFAULT_HEIGHT = 240;

function resolveInset(inset: Inset | undefined) {
  const d = typeof inset === 'number' ? inset : 8;
  const o = typeof inset === 'object' ? inset : {};
  return { top: o.top ?? d, right: o.right ?? d, bottom: o.bottom ?? d, left: o.left ?? d };
}

/** Axis components declare the space they need so the plot can shrink before the first paint. */
export interface AxisSpace {
  side: 'top' | 'right' | 'bottom' | 'left';
  size: number;
}
type AxisComponent = { axisSpace?: (props: Record<string, unknown>) => AxisSpace | null };

function collectAxisSpace(children: ReactNode, acc: Record<AxisSpace['side'], number>) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const type = child.type as AxisComponent;
    const props = child.props as Record<string, unknown> & { children?: ReactNode };
    if (typeof type === 'function' || typeof type === 'object') {
      const space = type.axisSpace?.(props);
      if (space) acc[space.side] = Math.max(acc[space.side], space.size);
    }
    // Look inside fragments (and other wrappers passing children through).
    if (props.children && !type.axisSpace) collectAxisSpace(props.children, acc);
  });
}

function useElementWidth(fixed: number | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fixed ?? 0);
  useEffect(() => {
    if (fixed !== undefined) {
      setWidth(fixed);
      return;
    }
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [fixed]);
  return [ref, width] as const;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const normalizeLegend = (legend: CartesianChartProps['legend']): LegendConfig | null =>
  legend === true ? { position: 'top' } : legend === false || legend === undefined ? null : typeof legend === 'string' ? { position: legend } : legend;

/**
 * The base of every x/y chart. Computes scales from `series` and provides them to its
 * children (Line, Area, BarPlot, XAxis, YAxis, ReferenceLine, Point, Scrubber), which draw
 * themselves as SVG. Compose your own chart from those parts, or use LineChart / AreaChart /
 * BarChart for the common layouts.
 */
export function CartesianChart({
  series,
  width: fixedWidth,
  height = DEFAULT_HEIGHT,
  inset,
  xAxis,
  yAxis,
  stacked = false,
  enableScrubbing = false,
  onScrubberPositionChange,
  getScrubberAccessibilityLabel,
  animate = true,
  legend = false,
  legendValueFormatter,
  emptyState,
  palette,
  className,
  style,
  'aria-label': ariaLabel,
  children,
}: CartesianChartProps) {
  // Letters and digits only: React's ids contain characters (:, «») that some SVG renderers reject in url(#…).
  const id = `fnv${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [wrapRef, width] = useElementWidth(fixedWidth);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [motion, setMotion] = useState(false);
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const [emphasis, setEmphasis] = useState<string | null>(null);
  useEffect(() => setMotion(animate && !prefersReducedMotion()), [animate]);

  const legendCfg = normalizeLegend(legend);

  // Colors are assigned over every series so hiding one never repaints the others.
  const all = useMemo<ResolvedSeries[]>(
    () => series.map((s, index) => ({ ...s, index, color: s.color ?? seriesColor(index, palette), dimmed: false })),
    [series, palette],
  );
  const resolved = useMemo<ResolvedSeries[]>(
    () => all.filter((s) => !hidden.includes(s.id)).map((s) => ({ ...s, dimmed: emphasis !== null && emphasis !== s.id })),
    [all, hidden, emphasis],
  );

  const axisSpace = useMemo(() => {
    const acc = { top: 0, right: 0, bottom: 0, left: 0 };
    collectAxisSpace(children, acc);
    return acc;
  }, [children]);

  const ctx = useMemo<CartesianContextValue>(() => {
    const ins = resolveInset(inset);
    const left = ins.left + axisSpace.left;
    const top = ins.top + axisSpace.top;
    const right = Math.max(left, width - ins.right - axisSpace.right);
    const bottom = Math.max(top, height - ins.bottom - axisSpace.bottom);
    const plot: PlotRect = { left, top, right, bottom, width: right - left, height: bottom - top };

    const length = Math.max(maxLength(all), xAxis?.data?.length ?? 0);
    const isBand = xAxis?.scaleType === 'band';
    const band = isBand ? bandScale(length, [left, right], xAxis?.bandPadding ?? 0.25) : null;
    const xLinear = linearScale([0, Math.max(1, length - 1)], [left, right]);
    const x = band ? (i: number) => band.center(i) : (i: number) => (length <= 1 ? (left + right) / 2 : xLinear(i));

    // The value range covers hidden series too, so toggling one doesn't rescale the rest.
    let stackedMap: Map<string, StackedSeries> | null = null;
    let [min, max] = extent(all) ?? [0, 1];
    if (stacked) {
      const st = stack(resolved);
      stackedMap = new Map(st.map((s) => [s.id, s]));
      [min, max] = stackedExtent(stack(all));
    }
    const log = yAxis?.scaleType === 'log';
    if (!log && (yAxis?.includeZero ?? isBand)) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    if (yAxis?.nice && !log) [min, max] = niceDomain(min, max, Math.max(2, Math.round(plot.height / 50)));
    if (yAxis?.domain?.min !== undefined) min = yAxis.domain.min;
    if (yAxis?.domain?.max !== undefined) max = yAxis.domain.max;
    const y = log ? logScale([Math.max(min, Number.MIN_VALUE), max], [bottom, top]) : linearScale([min, max], [bottom, top]);

    const xData = xAxis?.data;
    const xLabel = (i: number) => {
      const v = xData?.[i];
      return v === undefined ? String(i) : typeof v === 'number' ? formatNumber(v) : v;
    };
    return {
      id,
      width,
      height,
      plot,
      series: resolved,
      getSeries: (sid) => resolved.find((s) => s.id === sid),
      length,
      x,
      band,
      y,
      stacked: stackedMap,
      xLabel,
      xData,
      scrubIndex,
      focused,
      animate: motion,
    };
  }, [id, width, height, inset, axisSpace, all, resolved, xAxis, yAxis, stacked, scrubIndex, focused, motion]);

  const xsRef = useRef<number[]>([]);
  xsRef.current = useMemo(() => Array.from({ length: ctx.length }, (_, i) => ctx.x(i)), [ctx.length, ctx.x]);

  const updateScrub = useCallback(
    (next: number | null) => {
      setScrubIndex((prev) => {
        if (prev !== next) onScrubberPositionChange?.(next);
        return next;
      });
    },
    [onScrubberPositionChange],
  );

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = ctx.band ? ctx.band.invert(px) : nearestIndex(xsRef.current, px);
    updateScrub(i < 0 ? null : i);
  };
  const onPointerLeave = () => {
    if (!focused) updateScrub(null);
  };

  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    const last = ctx.length - 1;
    if (last < 0) return;
    const step = e.shiftKey ? 10 : 1;
    const cur = scrubIndex ?? last;
    let next: number | null | undefined;
    if (e.key === 'ArrowLeft') next = Math.max(0, (scrubIndex === null ? last + 1 : cur) - step);
    else if (e.key === 'ArrowRight') next = Math.min(last, (scrubIndex === null ? -1 : cur) + step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') next = null;
    if (next === undefined) return;
    e.preventDefault();
    updateScrub(next);
  };

  const hasData = all.some((s) => s.data.some((v) => v !== null && Number.isFinite(v)));
  const a11yText = (i: number) =>
    getScrubberAccessibilityLabel
      ? getScrubberAccessibilityLabel(i)
      : [ctx.xLabel(i), ...resolved.map((s) => `${s.label ?? s.id} ${s.data[i] === null || s.data[i] === undefined ? '—' : formatNumber(s.data[i]!)}`)].join(', ');

  const legendEl = legendCfg && (
    <Legend
      direction={legendCfg.position === 'left' || legendCfg.position === 'right' ? 'column' : 'row'}
      {...(legendCfg.shape ? { shape: legendCfg.shape } : {})}
      items={all.map((s) => {
        const v = scrubIndex === null ? null : s.data[scrubIndex];
        return {
          id: s.id,
          label: s.label ?? s.id,
          color: s.color,
          inactive: hidden.includes(s.id) || (emphasis !== null && emphasis !== s.id),
          value: v === null || v === undefined ? undefined : legendValueFormatter ? legendValueFormatter(v, s.id) : formatNumber(v),
        };
      })}
      {...(legendCfg.interactive
        ? {
            onItemClick: (sid: string) => setHidden((h) => (h.includes(sid) ? h.filter((x) => x !== sid) : [...h, sid])),
            onItemHover: (sid: string | null) => setEmphasis(sid && !hidden.includes(sid) ? sid : null),
          }
        : {})}
    />
  );
  const side = legendCfg?.position === 'left' || legendCfg?.position === 'right';

  const svg = (
    <svg
      width={width || '100%'}
      height={height}
      role="img"
      aria-label={ariaLabel}
      tabIndex={enableScrubbing && hasData ? 0 : undefined}
      style={{
        display: 'block',
        overflow: 'visible',
        touchAction: enableScrubbing ? 'pan-y' : undefined,
        userSelect: 'none',
        outline: 'none',
        borderRadius: 6,
        boxShadow: focused ? `0 0 0 2px ${VAR.accentRing}` : undefined,
      }}
      onPointerMove={enableScrubbing ? onPointerMove : undefined}
      onPointerDown={enableScrubbing ? onPointerMove : undefined}
      onPointerLeave={enableScrubbing ? onPointerLeave : undefined}
      onPointerCancel={enableScrubbing ? onPointerLeave : undefined}
      onKeyDown={enableScrubbing ? onKeyDown : undefined}
      onFocus={enableScrubbing ? () => setFocused(true) : undefined}
      onBlur={
        enableScrubbing
          ? () => {
              setFocused(false);
              updateScrub(null);
            }
          : undefined
      }
    >
      {width > 0 && hasData && <CartesianContext.Provider value={ctx}>{children}</CartesianContext.Provider>}
      {width > 0 && !hasData && (
        <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central" fontSize={13} style={{ fill: VAR.text, fontFamily: VAR.font }}>
          {typeof emptyState === 'string' || emptyState === undefined ? (emptyState ?? '') : null}
        </text>
      )}
    </svg>
  );

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: 'relative',
        width: fixedWidth ?? '100%',
        ...(side ? { display: 'flex', alignItems: 'center', gap: 16, flexDirection: legendCfg?.position === 'left' ? 'row-reverse' : 'row' } : {}),
        ...style,
      }}
    >
      {legendCfg?.position === 'top' || (legendCfg && !legendCfg.position) ? legendEl : null}
      {side ? <div style={{ flex: 1, minWidth: 0 }}>{svg}</div> : svg}
      {side && legendEl}
      {legendCfg?.position === 'bottom' && legendEl}
      {!hasData && emptyState !== undefined && typeof emptyState !== 'string' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{emptyState}</div>
      )}
      {/* Spoken position while scrubbing with the keyboard. */}
      {enableScrubbing && (
        <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {focused && scrubIndex !== null ? a11yText(scrubIndex) : ''}
        </span>
      )}
    </div>
  );
}

export const DEFAULT_CHART_HEIGHT = DEFAULT_HEIGHT;
