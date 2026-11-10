import { percentages, seriesColor, type Curve } from '@funnest/charts-viz';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { XAxis, YAxis, type XAxisProps, type YAxisProps } from './axes';
import { BarPlot, type BarPlotProps } from './bar';
import { CartesianChart, type CartesianChartProps } from './cartesian-chart';
import { formatNumber, VAR } from './context';
import { Legend } from './legend';
import { Area, Line, type AreaFill } from './line';
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

export interface LineChartProps extends PresetProps {
  curve?: Curve;
  strokeWidth?: number;
  /** Fill under each line. Default 'none'. */
  area?: AreaFill;
  connectNulls?: boolean;
}

/**
 * Lines for every series. With no axes it is a sparkline:
 * `<LineChart series={[{ id: 'p', data }]} height={40} inset={2} />`.
 */
export function LineChart({ showXAxis, showYAxis, scrubber, curve, strokeWidth, area, connectNulls, children, ...chart }: LineChartProps) {
  const sc = axisProps(scrubber);
  return (
    <CartesianChart enableScrubbing={!!sc} {...chart}>
      {axisElements(axisProps(showXAxis), axisProps(showYAxis))}
      {chart.series.map((s) => (
        <Line
          key={s.id}
          seriesId={s.id}
          {...(curve ? { curve } : {})}
          {...(strokeWidth ? { strokeWidth } : {})}
          {...(area ? { area } : {})}
          {...(connectNulls ? { connectNulls } : {})}
        />
      ))}
      {children}
      {sc && <Scrubber {...sc} />}
    </CartesianChart>
  );
}

export interface AreaChartProps extends PresetProps {
  curve?: Curve;
  fill?: Exclude<AreaFill, 'none'>;
  /** Draw the top edge line. Default true. */
  showLines?: boolean;
  strokeWidth?: number;
}

/** Filled areas; set `stacked` for a composition over time (e.g. portfolio by asset). */
export function AreaChart({ showXAxis, showYAxis, scrubber, curve = 'monotone', fill = 'gradient', showLines = true, strokeWidth = 2, children, ...chart }: AreaChartProps) {
  const sc = axisProps(scrubber);
  return (
    <CartesianChart enableScrubbing={!!sc} {...chart}>
      {axisElements(axisProps(showXAxis), axisProps(showYAxis))}
      {chart.series.map((s) => (
        <Area key={`a${s.id}`} seriesId={s.id} curve={curve} fill={chart.stacked ? 'solid' : fill} {...(chart.stacked ? { opacity: 0.55 } : {})} />
      ))}
      {showLines && chart.series.map((s) => <Line key={`l${s.id}`} seriesId={s.id} curve={curve} strokeWidth={strokeWidth} />)}
      {children}
      {sc && <Scrubber {...sc} />}
    </CartesianChart>
  );
}

export interface BarChartProps extends PresetProps, Pick<BarPlotProps, 'radius' | 'getBarColor' | 'groupGap'> {}

/** Grouped (or `stacked`) bars on a categorical x axis. Hover highlights a bar when `scrubber`. */
export function BarChart({ showXAxis, showYAxis, scrubber, radius, getBarColor, groupGap, xAxis, children, ...chart }: BarChartProps) {
  const sc = axisProps(scrubber);
  return (
    <CartesianChart enableScrubbing={!!sc} xAxis={{ ...xAxis, scaleType: 'band' }} {...chart}>
      {axisElements(axisProps(showXAxis), axisProps(showYAxis))}
      <BarPlot
        {...(radius === undefined ? {} : { radius })}
        {...(getBarColor ? { getBarColor } : {})}
        {...(groupGap === undefined ? {} : { groupGap })}
        highlightScrubbed={!!sc}
      />
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
  /** Labels with percentages under the bar. Default true. */
  showLabels?: boolean;
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
  showLabels = true,
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
  return (
    <div className={className} style={{ fontFamily: VAR.font, ...style }} role="img" aria-label={ariaLabel ?? items.map((i) => `${i.label} ${formatLabel(i, i.fraction)}`).join(', ')}>
      <div style={{ display: 'flex', gap, height: barHeight }}>
        {visible.map((i, k) => (
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
              borderRadius: `${k === 0 ? barHeight / 2 : 2}px ${k === visible.length - 1 ? barHeight / 2 : 2}px ${k === visible.length - 1 ? barHeight / 2 : 2}px ${k === 0 ? barHeight / 2 : 2}px`,
              transition: 'flex-grow 0.4s ease, opacity 0.15s',
              cursor: 'default',
            }}
          />
        ))}
      </div>
      {showLabels && (
        <Legend
          style={{ marginTop: 8 }}
          items={items.map((i) => ({ id: i.id, label: i.label, color: i.color, value: formatLabel(i, i.fraction), inactive: !!hovered && hovered !== i.id }))}
          onItemHover={setHovered}
        />
      )}
    </div>
  );
}
