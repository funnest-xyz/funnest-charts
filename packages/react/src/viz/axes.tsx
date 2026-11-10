import { logTicks, sampleIndices, ticks as niceTicks } from '@funnest/charts-viz';
import { formatNumber, useCartesianChart, VAR } from './context';

export interface XAxisProps {
  position?: 'bottom' | 'top';
  /** Space reserved for the axis. Default 24. */
  height?: number;
  /** Indices to label. Default: evenly spaced, about one label per 80px. */
  ticks?: readonly number[];
  /** Label for x position `index` (value is `xAxis.data[index]`, if any). */
  tickLabelFormatter?: (value: string | number | undefined, index: number) => string;
  showLine?: boolean;
  showTickMarks?: boolean;
  /** Vertical grid lines at each tick. */
  showGrid?: boolean;
  /** Minimum pixels per label when picking ticks automatically. Default 80. */
  minTickSpacing?: number;
}

export function XAxis({
  position = 'bottom',
  height = 24,
  ticks,
  tickLabelFormatter,
  showLine = false,
  showTickMarks = false,
  showGrid = false,
  minTickSpacing = 80,
}: XAxisProps) {
  const ctx = useCartesianChart();
  const { plot } = ctx;
  if (ctx.length === 0) return null;
  const indices = ticks ?? sampleIndices(ctx.length, Math.max(1, Math.floor(plot.width / minTickSpacing)));
  // The axis band sits at the very edge of the SVG, outside the plot inset.
  const lineY = position === 'bottom' ? ctx.height - height : height;
  const textY = position === 'bottom' ? lineY + height / 2 + 4 : lineY - height / 2 + 4;
  return (
    <g aria-hidden="true" style={{ fontFamily: VAR.font }}>
      {showGrid &&
        indices.map((i) => (
          <line key={`g${i}`} x1={ctx.x(i)} x2={ctx.x(i)} y1={plot.top} y2={plot.bottom} shapeRendering="crispEdges" style={{ stroke: VAR.grid }} />
        ))}
      {showLine && <line x1={plot.left} x2={plot.right} y1={lineY} y2={lineY} shapeRendering="crispEdges" style={{ stroke: VAR.line }} />}
      {indices.map((i) => {
        const x = ctx.x(i);
        const label = tickLabelFormatter ? tickLabelFormatter(ctx.xData?.[i], i) : ctx.xLabel(i);
        // Keep edge labels inside the chart.
        const anchor = x - plot.left < 24 ? 'start' : plot.right - x < 24 ? 'end' : 'middle';
        return (
          <g key={i}>
            {showTickMarks && (
              <line x1={x} x2={x} y1={lineY} y2={position === 'bottom' ? lineY + 4 : lineY - 4} style={{ stroke: VAR.line }} />
            )}
            <text x={x} y={textY} textAnchor={anchor} fontSize={11} style={{ fill: VAR.text }}>
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
XAxis.axisSpace = (p: XAxisProps) => ({ side: p.position ?? 'bottom', size: p.height ?? 24 });

export interface YAxisProps {
  /** Right is the trading-chart convention. Default 'right'. */
  position?: 'left' | 'right';
  /** Space reserved for labels. Default 48. */
  width?: number;
  /** Explicit tick values. Default: nice numbers, about one per 40px. */
  ticks?: readonly number[];
  tickLabelFormatter?: (value: number) => string;
  /** Horizontal grid lines across the plot. Default true. */
  showGrid?: boolean;
  showLine?: boolean;
  /** Minimum pixels between ticks when picking automatically. Default 32. */
  minTickSpacing?: number;
}

export function YAxis({
  position = 'right',
  width = 48,
  ticks,
  tickLabelFormatter = formatNumber,
  showGrid = true,
  showLine = false,
  minTickSpacing = 32,
}: YAxisProps) {
  const ctx = useCartesianChart();
  const { plot, y } = ctx;
  const [d0, d1] = y.domain;
  const count = Math.max(2, Math.floor(plot.height / minTickSpacing));
  const values = (ticks ?? (y.kind === 'log' ? logTicks(d0, d1, count) : niceTicks(d0, d1, count))).filter(
    (v) => v >= Math.min(d0, d1) - 1e-9 && v <= Math.max(d0, d1) + 1e-9,
  );
  const right = position === 'right';
  const textX = right ? ctx.width - width + 8 : width - 8;
  const lineX = right ? ctx.width - width : width;
  return (
    <g aria-hidden="true" style={{ fontFamily: VAR.font }}>
      {showGrid &&
        values.map((v) => (
          <line key={`g${v}`} x1={plot.left} x2={plot.right} y1={y(v)} y2={y(v)} shapeRendering="crispEdges" style={{ stroke: VAR.grid }} />
        ))}
      {showLine && <line x1={lineX} x2={lineX} y1={plot.top} y2={plot.bottom} shapeRendering="crispEdges" style={{ stroke: VAR.line }} />}
      {values.map((v) => (
        <text key={v} x={textX} y={y(v) + 4} textAnchor={right ? 'start' : 'end'} fontSize={11} style={{ fill: VAR.text }}>
          {tickLabelFormatter(v)}
        </text>
      ))}
    </g>
  );
}
YAxis.axisSpace = (p: YAxisProps) => ({ side: p.position ?? 'right', size: p.width ?? 48 });
