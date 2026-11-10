import { percentages, seriesColor, type Curve } from '@funnest/charts-viz';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { XAxis, YAxis, type XAxisProps, type YAxisProps } from './axes';
import { BarPlot, type BarPlotProps } from './bar';
import { CartesianChart, type CartesianChartProps } from './cartesian-chart';
import { formatNumber, VAR, type LineStyle } from './context';
import { Legend, type LegendShape } from './legend';
import { Area, Line, type AreaFill, type GradientStop, type LineProps, type SplitColors } from './line';
import { Scrubber, type ScrubberProps } from './scrubber';

type AxisToggle<P> = boolean | P;
const axisProps = <P,>(v: AxisToggle<P> | undefined): P | null => (v ? (v === true ? ({} as P) : v) : null);

interface PresetProps extends Omit<CartesianChartProps, 'children'> {
  showXAxis?: AxisToggle<XAxisProps>;
  showYAxis?: AxisToggle<YAxisProps>;
  /** Pointer-follow line + dots (turns on `enableScrubbing`). */
  scrubber?: AxisToggle<ScrubberProps>;
  /** Extra parts drawn on top: ReferenceLine, Point, … */
  children?: ReactNode;
}

// Axis space is read from the chart's direct children, so render axes inline (not via <Axes>).
const axisElements = (x: XAxisProps | null, y: YAxisProps | null) => [
  y && <YAxis key="y" {...y} />,
  x && <XAxis key="x" {...x} />,
];

/** Only pass defined values (exactOptionalPropertyTypes-friendly). */
const defined = <T extends object>(o: T): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };

export interface LineChartProps extends PresetProps {
  curve?: Curve;
  strokeWidth?: number;
  /** 'solid' (default), 'dashed' or 'dotted' for every line (a series' `lineStyle` wins). */
  lineStyle?: LineStyle;
  /** Fill under each line. Default 'none'. */
  area?: AreaFill;
  connectNulls?: boolean;
  /** Dots on the points (see Line `points`). */
  points?: LineProps['points'];
  /** Split line and area colors at this value (e.g. the starting price). */
  baseline?: number;
  /** With `baseline`: colors above / below. Default red / blue (Korean up / down). */
  splitColors?: SplitColors;
}

const KR_SPLIT: SplitColors = { above: '#F04452', below: '#3182F6' };

/**
 * Lines for every series. With no axes it is a sparkline:
 * `<LineChart series={[{ id: 'p', data }]} height={40} inset={2} />`.
 */
export function LineChart({
  showXAxis,
  showYAxis,
  scrubber,
  curve,
  strokeWidth,
  lineStyle,
  area,
  connectNulls,
  points,
  baseline,
  splitColors,
  children,
  ...chart
}: LineChartProps) {
  const sc = axisProps(scrubber);
  const split = baseline !== undefined ? (splitColors ?? KR_SPLIT) : undefined;
  return (
    <CartesianChart enableScrubbing={!!sc} {...chart}>
      {axisElements(axisProps(showXAxis), axisProps(showYAxis))}
      {chart.series.map((s) => (
        <Line
          key={s.id}
          seriesId={s.id}
          {...defined({ curve, strokeWidth, lineStyle, connectNulls, points, baseline, splitColors: split })}
          {...((s.areaStyle ?? area) ? { area: s.areaStyle ?? area! } : {})}
        />
      ))}
      {children}
      {sc && (
        <Scrubber
          {...(split && baseline !== undefined ? { beaconColor: (v: number) => (v >= baseline ? split.above : split.below) } : {})}
          {...sc}
        />
      )}
    </CartesianChart>
  );
}

export interface AreaChartProps extends PresetProps {
  curve?: Curve;
  /** 'gradient' (default), 'solid' or 'dotted'. A series' `areaStyle` wins. */
  fill?: Exclude<AreaFill, 'none'>;
  /** Draw the top edge line. Default true. */
  showLines?: boolean;
  strokeWidth?: number;
  lineStyle?: LineStyle;
  /** Fill toward this value instead of 0 (e.g. the starting price). */
  baseline?: number;
  /** With `baseline`: colors above / below. */
  splitColors?: SplitColors;
  /** Custom gradient stops (offset 0 = line, 1 = baseline). */
  gradientStops?: readonly GradientStop[];
  fillOpacity?: number;
}

/** Filled areas; set `stacked` for a composition over time (e.g. portfolio by asset). */
export function AreaChart({
  showXAxis,
  showYAxis,
  scrubber,
  curve = 'monotone',
  fill = 'gradient',
  showLines = true,
  strokeWidth = 2,
  lineStyle,
  baseline,
  splitColors,
  gradientStops,
  fillOpacity,
  children,
  ...chart
}: AreaChartProps) {
  const sc = axisProps(scrubber);
  return (
    <CartesianChart enableScrubbing={!!sc} {...chart}>
      {axisElements(axisProps(showXAxis), axisProps(showYAxis))}
      {chart.series.map((s) => {
        const own = s.areaStyle === 'none' ? null : (s.areaStyle ?? (chart.stacked && fill === 'gradient' ? 'solid' : fill));
        return own ? (
          <Area
            key={`a${s.id}`}
            seriesId={s.id}
            curve={curve}
            fill={own}
            {...defined({ baseline, splitColors, gradientStops, opacity: fillOpacity ?? (chart.stacked && own === 'solid' ? 0.55 : undefined) })}
          />
        ) : null;
      })}
      {showLines &&
        chart.series.map((s) => (
          <Line key={`l${s.id}`} seriesId={s.id} curve={curve} strokeWidth={strokeWidth} {...defined({ lineStyle, baseline, splitColors })} />
        ))}
      {children}
      {sc && <Scrubber {...sc} />}
    </CartesianChart>
  );
}

export interface BarChartProps extends PresetProps, Pick<BarPlotProps, 'radius' | 'getBarColor' | 'groupGap' | 'stackGap' | 'roundBaseline'> {
  /** Smallest drawn bar length for non-zero values, px. */
  barMinSize?: number;
}

/** Grouped (or `stacked`) bars on a categorical x axis. Hover highlights a bar when `scrubber`. */
export function BarChart({ showXAxis, showYAxis, scrubber, radius, getBarColor, groupGap, stackGap, roundBaseline, barMinSize, xAxis, children, ...chart }: BarChartProps) {
  const sc = axisProps(scrubber);
  return (
    <CartesianChart enableScrubbing={!!sc} xAxis={{ ...xAxis, scaleType: 'band' }} {...chart}>
      {axisElements(axisProps(showXAxis), axisProps(showYAxis))}
      <BarPlot {...defined({ radius, getBarColor, groupGap, stackGap, roundBaseline, minSize: barMinSize })} highlightScrubbed={!!sc} />
      {children}
      {sc && <Scrubber {...sc} />}
    </CartesianChart>
  );
}

export interface PercentageBarItem {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface PercentageBarChartProps {
  data: readonly PercentageBarItem[];
  /** Bar thickness. Default 10. */
  barHeight?: number;
  /** Gap between segments, px. Default 2. */
  gap?: number;
  /** Corner radius of the bar ends. Default barHeight / 2 (fully round). */
  radius?: number;
  /** Labels with percentages. Default true. */
  showLabels?: boolean;
  /** Where the labels go. Default 'bottom'. */
  legendPosition?: 'top' | 'bottom' | 'right';
  legendShape?: LegendShape;
  /** Format the label value. Default: "62.5%". */
  formatLabel?: (item: PercentageBarItem, fraction: number) => string;
  palette?: readonly string[];
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

/**
 * One horizontal bar split into shares: portfolio weights, buy/sell pressure,
 * long/short ratio.
 */
export function PercentageBarChart({
  data,
  barHeight = 10,
  gap = 2,
  radius,
  showLabels = true,
  legendPosition = 'bottom',
  legendShape,
  formatLabel = (_item, f) => `${formatNumber(Math.round(f * 1000) / 10)}%`,
  palette,
  className,
  style,
  'aria-label': ariaLabel,
}: PercentageBarChartProps) {
  const segs = percentages(data);
  const items = data.map((d, i) => ({ ...d, color: d.color ?? seriesColor(i, palette), fraction: segs[i]!.fraction }));
  const visible = items.filter((i) => i.fraction > 0);
  // Hovering a segment or its legend item highlights it and dims the rest.
  const [hovered, setHovered] = useState<string | null>(null);
  const end = radius ?? barHeight / 2;
  const inner = Math.min(2, end);
  const bar = (
    <div style={{ display: 'flex', gap, height: barHeight, flex: legendPosition === 'right' ? 1 : undefined }}>
      {visible.map((i, k) => {
        const l = k === 0 ? end : inner;
        const r = k === visible.length - 1 ? end : inner;
        return (
          <span
            key={i.id}
            title={`${i.label} ${formatLabel(i, i.fraction)}`}
            onPointerEnter={() => setHovered(i.id)}
            onPointerLeave={() => setHovered(null)}
            style={{
              opacity: hovered && hovered !== i.id ? 0.3 : 1,
              flex: `${i.fraction} 1 0`,
              minWidth: 2,
              background: i.color,
              borderRadius: `${l}px ${r}px ${r}px ${l}px`,
              transition: 'flex-grow 0.4s ease, opacity 0.15s',
              cursor: 'default',
            }}
          />
        );
      })}
    </div>
  );
  const legend = showLabels && (
    <Legend
      style={legendPosition === 'top' ? { marginBottom: 8 } : legendPosition === 'bottom' ? { marginTop: 8 } : {}}
      direction={legendPosition === 'right' ? 'column' : 'row'}
      {...(legendShape ? { shape: legendShape } : {})}
      items={items.map((i) => ({ id: i.id, label: i.label, color: i.color, value: formatLabel(i, i.fraction), inactive: !!hovered && hovered !== i.id }))}
      onItemHover={setHovered}
    />
  );
  return (
    <div
      className={className}
      style={{ fontFamily: VAR.font, ...(legendPosition === 'right' ? { display: 'flex', alignItems: 'center', gap: 16 } : {}), ...style }}
      role="img"
      aria-label={ariaLabel ?? items.map((i) => `${i.label} ${formatLabel(i, i.fraction)}`).join(', ')}
    >
      {legendPosition === 'top' && legend}
      {bar}
      {legendPosition !== 'top' && legend}
    </div>
  );
}
