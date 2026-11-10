import { percentages, seriesColor, type Curve } from '@funnest/charts-viz';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { XAxis, YAxis, type XAxisProps, type YAxisProps } from './axes';
import { BarPlot, type BarPlotProps } from './bar';
import { CartesianChart, type CartesianChartProps } from './cartesian-chart';
import { formatNumber, VAR, type LineStyle } from './context';
import { Legend, type LegendShape } from './legend';
import { HorizontalBarChart } from './horizontal-bar';
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
  /**
   * 'vertical' (default) bars grow up from the x axis; 'horizontal' bars run left → right,
   * one row per `xAxis.data` category (rankings, holdings, sector P&L).
   */
  layout?: 'vertical' | 'horizontal';
}

/** Grouped (or `stacked`) bars on a categorical x axis. Hover highlights a bar when `scrubber`. */
export function BarChart({ showXAxis, showYAxis, scrubber, radius, getBarColor, groupGap, stackGap, roundBaseline, barMinSize, layout = 'vertical', xAxis, children, ...chart }: BarChartProps) {
  const sc = axisProps(scrubber);
  if (layout === 'horizontal') {
    const yAx = axisProps(showYAxis);
    return (
      <HorizontalBarChart
        series={chart.series}
        categories={(xAxis?.data ?? []).map(String)}
        showValueAxis={!!showYAxis}
        showCategoryAxis={showXAxis !== false}
        enableScrubbing={!!sc || chart.enableScrubbing === true}
        legend={!!chart.legend}
        {...defined({
          width: chart.width,
          height: chart.height,
          stacked: chart.stacked,
          radius,
          getBarColor,
          groupGap,
          stackGap,
          bandPadding: xAxis?.bandPadding,
          valueFormatter: yAx?.tickLabelFormatter,
          palette: chart.palette,
          className: chart.className,
          style: chart.style,
          'aria-label': chart['aria-label'],
        })}
      />
    );
  }
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

export interface PercentageBarRow {
  id: string;
  /** Shown beside the bar (e.g. account name, date). */
  label?: string;
  data: readonly PercentageBarItem[];
}

export interface PercentageBarChartProps {
  /** One bar. Use `rows` for several bars that share a legend. */
  data?: readonly PercentageBarItem[];
  /** Several bars compared row by row (items are matched by `id`, so colors stay consistent). */
  rows?: readonly PercentageBarRow[];
  /** 'horizontal' (default) or 'vertical' (columns that fill bottom → top). */
  layout?: 'horizontal' | 'vertical';
  /** Bar thickness. Default 10 (horizontal), 28 (vertical). */
  barHeight?: number;
  /** Bar length for `layout: 'vertical'`, px. Default 160. */
  barLength?: number;
  /** Gap between segments, px. Default 2. */
  gap?: number;
  /** Corner radius of the bar ends. Default barHeight / 2 (fully round) horizontally, 6 vertically. */
  radius?: number;
  /** Labels with percentages. Default true. */
  showLabels?: boolean;
  /** Where the labels go. Default 'bottom' ('right' for vertical). */
  legendPosition?: 'top' | 'bottom' | 'right';
  legendShape?: LegendShape;
  /** Format the label value. Default: "62.5%". */
  formatLabel?: (item: PercentageBarItem, fraction: number) => string;
  palette?: readonly string[];
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

const pct = (_item: PercentageBarItem, f: number) => `${formatNumber(Math.round(f * 1000) / 10)}%`;

/**
 * A bar split into shares: portfolio weights, buy/sell pressure, long/short ratio.
 * `rows` compares several (accounts, months) with one shared legend; `layout: 'vertical'` stands them up.
 */
export function PercentageBarChart({
  data,
  rows,
  layout = 'horizontal',
  barHeight,
  barLength = 160,
  gap = 2,
  radius,
  showLabels = true,
  legendPosition,
  legendShape,
  formatLabel = pct,
  palette,
  className,
  style,
  'aria-label': ariaLabel,
}: PercentageBarChartProps) {
  const vertical = layout === 'vertical';
  const thick = barHeight ?? (vertical ? 28 : 10);
  const end = radius ?? (vertical ? Math.min(6, thick / 2) : thick / 2);
  const inner = Math.min(2, end);
  const legendAt = legendPosition ?? (vertical ? 'right' : 'bottom');
  const allRows: readonly PercentageBarRow[] = rows ?? [{ id: 'row', data: data ?? [] }];
  const multi = allRows.length > 1 || !!rows;

  // Colors by item id across rows, in first-seen order.
  const colorOf = new Map<string, string>();
  const legendItems: PercentageBarItem[] = [];
  for (const r of allRows)
    for (const d of r.data)
      if (!colorOf.has(d.id)) {
        colorOf.set(d.id, d.color ?? seriesColor(colorOf.size, palette));
        legendItems.push(d);
      }

  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const rowSegs = allRows.map((r) => {
    const segs = percentages(r.data);
    return { row: r, items: r.data.map((d, i) => ({ ...d, color: colorOf.get(d.id)!, fraction: segs[i]!.fraction })) };
  });

  const renderBar = (items: (PercentageBarItem & { color: string; fraction: number })[], rowId: string) => {
    const visible = items.filter((i) => i.fraction > 0);
    // Vertical bars fill bottom → top, so the first item sits at the bottom.
    const ordered = vertical ? [...visible].reverse() : visible;
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: vertical ? 'column' : 'row',
          gap,
          ...(vertical ? { width: thick, height: barLength } : { height: thick, flex: 1, minWidth: 0 }),
        }}
      >
        {ordered.map((i, k) => {
          const a = k === 0 ? end : inner;
          const b = k === ordered.length - 1 ? end : inner;
          return (
            <span
              key={i.id}
              title={`${i.label} ${formatLabel(i, i.fraction)}`}
              onPointerEnter={() => {
                setHovered(i.id);
                setHoverRow(rowId);
              }}
              onPointerLeave={() => {
                setHovered(null);
                setHoverRow(null);
              }}
              style={{
                opacity: hovered && hovered !== i.id ? 0.3 : 1,
                flex: `${i.fraction} 1 0`,
                [vertical ? 'minHeight' : 'minWidth']: 2,
                background: i.color,
                borderRadius: vertical ? `${a}px ${a}px ${b}px ${b}px` : `${a}px ${b}px ${b}px ${a}px`,
                transition: 'flex-grow 0.4s ease, opacity 0.15s',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>
    );
  };

  // Single bar: the legend shows that bar's percentages. Several: values of the hovered row (or none).
  const legendRow = multi ? rowSegs.find((r) => r.row.id === hoverRow) : rowSegs[0];
  const legend = showLabels && (
    <Legend
      style={legendAt === 'top' ? { marginBottom: 10 } : legendAt === 'bottom' ? { marginTop: 10 } : {}}
      direction={legendAt === 'right' ? 'column' : 'row'}
      {...(legendShape ? { shape: legendShape } : {})}
      items={legendItems.map((d) => {
        const it = legendRow?.items.find((x) => x.id === d.id);
        return {
          id: d.id,
          label: d.label,
          color: colorOf.get(d.id)!,
          ...(it ? { value: formatLabel(it, it.fraction) } : {}),
          inactive: !!hovered && hovered !== d.id,
        };
      })}
      onItemHover={setHovered}
    />
  );

  const label = (r: PercentageBarRow) =>
    multi && r.label ? (
      <span style={{ fontSize: 12, color: hoverRow === r.id ? VAR.textStrong : VAR.text, fontWeight: hoverRow === r.id ? 700 : 500, whiteSpace: 'nowrap' }}>{r.label}</span>
    ) : null;

  const bars = vertical ? (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
      {rowSegs.map(({ row, items }) => (
        <div key={row.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {renderBar(items, row.id)}
          {label(row)}
        </div>
      ))}
    </div>
  ) : multi ? (
    <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 12, rowGap: 10, alignItems: 'center', flex: legendAt === 'right' ? 1 : undefined }}>
      {rowSegs.map(({ row, items }) => (
        <div key={row.id} style={{ display: 'contents' }}>
          {label(row) ?? <span />}
          {renderBar(items, row.id)}
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: 'flex', flex: legendAt === 'right' ? 1 : undefined }}>{renderBar(rowSegs[0]!.items, rowSegs[0]!.row.id)}</div>
  );

  return (
    <div
      className={className}
      style={{ fontFamily: VAR.font, ...(legendAt === 'right' ? { display: 'flex', alignItems: 'center', gap: 16 } : {}), ...style }}
      role="img"
      aria-label={
        ariaLabel ??
        rowSegs.map(({ row, items }) => `${row.label ? `${row.label}: ` : ''}${items.map((i) => `${i.label} ${formatLabel(i, i.fraction)}`).join(', ')}`).join('; ')
      }
    >
      {legendAt === 'top' && legend}
      {bars}
      {legendAt !== 'top' && legend}
    </div>
  );
}
