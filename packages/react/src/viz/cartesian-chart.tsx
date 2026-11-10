import {
  bandScale,
  extent,
  linearScale,
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
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { CartesianContext, formatNumber, type CartesianContextValue, type ChartSeries, type PlotRect, type ResolvedSeries } from './context';
import { Legend, type LegendPosition } from './legend';

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
  /** Track the pointer and expose the hovered index to <Scrubber>, legends and headers. */
  enableScrubbing?: boolean;
  onScrubberPositionChange?: (index: number | null) => void;
  /** Draw-in animation on mount. Default true (off when the user prefers reduced motion). */
  animate?: boolean;
  /** Series legend outside the plot. */
  legend?: boolean | LegendPosition;
  /** Format legend values while scrubbing. */
  legendValueFormatter?: (value: number, seriesId: string) => string;
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
  animate = true,
  legend = false,
  legendValueFormatter,
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
  const [motion, setMotion] = useState(false);
  useEffect(() => setMotion(animate && !prefersReducedMotion()), [animate]);

  const resolved = useMemo<ResolvedSeries[]>(
    () => series.map((s, index) => ({ ...s, index, color: s.color ?? seriesColor(index, palette) })),
    [series, palette],
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

    const length = Math.max(maxLength(resolved), xAxis?.data?.length ?? 0);
    const isBand = xAxis?.scaleType === 'band';
    const band = isBand ? bandScale(length, [left, right], xAxis?.bandPadding ?? 0.25) : null;
    const xLinear = linearScale([0, Math.max(1, length - 1)], [left, right]);
    const x = band ? (i: number) => band.center(i) : (i: number) => (length <= 1 ? (left + right) / 2 : xLinear(i));

    let stackedMap: Map<string, StackedSeries> | null = null;
    let [min, max] = extent(resolved) ?? [0, 1];
    if (stacked) {
      const st = stack(resolved);
      stackedMap = new Map(st.map((s) => [s.id, s]));
      [min, max] = stackedExtent(st);
    }
    if (yAxis?.includeZero ?? isBand) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
    if (yAxis?.nice) [min, max] = niceDomain(min, max, Math.max(2, Math.round(plot.height / 50)));
    if (yAxis?.domain?.min !== undefined) min = yAxis.domain.min;
    if (yAxis?.domain?.max !== undefined) max = yAxis.domain.max;
    const y = linearScale([min, max], [bottom, top]);

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
      animate: motion,
    };
  }, [id, width, height, inset, axisSpace, resolved, xAxis, yAxis, stacked, scrubIndex, motion]);

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
    if (!enableScrubbing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = ctx.band ? ctx.band.invert(px) : nearestIndex(xsRef.current, px);
    updateScrub(i < 0 ? null : i);
  };
  const onPointerLeave = () => enableScrubbing && updateScrub(null);

  const legendPos: LegendPosition | null = legend === true ? 'top' : legend === false ? null : legend;
  const legendEl = legendPos && (
    <Legend
      items={resolved.map((s) => {
        const v = scrubIndex === null ? null : s.data[scrubIndex];
        return {
          id: s.id,
          label: s.label ?? s.id,
          color: s.color,
          value: v === null || v === undefined ? undefined : legendValueFormatter ? legendValueFormatter(v, s.id) : formatNumber(v),
        };
      })}
    />
  );

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', width: fixedWidth ?? '100%', ...style }}>
      {legendPos === 'top' && legendEl}
      <svg
        width={width || '100%'}
        height={height}
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', overflow: 'visible', touchAction: enableScrubbing ? 'pan-y' : undefined, userSelect: 'none' }}
        onPointerMove={enableScrubbing ? onPointerMove : undefined}
        onPointerDown={enableScrubbing ? onPointerMove : undefined}
        onPointerLeave={enableScrubbing ? onPointerLeave : undefined}
        onPointerCancel={enableScrubbing ? onPointerLeave : undefined}
      >
        {width > 0 && <CartesianContext.Provider value={ctx}>{children}</CartesianContext.Provider>}
      </svg>
      {legendPos === 'bottom' && legendEl}
    </div>
  );
}

export const DEFAULT_CHART_HEIGHT = DEFAULT_HEIGHT;
