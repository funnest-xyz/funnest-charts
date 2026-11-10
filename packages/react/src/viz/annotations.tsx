import { formatNumber, useCartesianChart, VAR } from './context';

export interface ReferenceLineProps {
  /** Horizontal line at this value (target price, average entry, 0%). */
  dataY?: number;
  /** Vertical line at this x index (event, earnings date). */
  dataX?: number;
  label?: string;
  /** Where the label sits along the line. Default 'right' (horizontal) / 'top' (vertical). */
  labelPosition?: 'left' | 'right' | 'center' | 'top' | 'bottom';
  color?: string;
  /** Dash pattern; '' for a solid line. Default '4 4'. */
  dash?: string;
  strokeWidth?: number;
}

export function ReferenceLine({ dataY, dataX, label, labelPosition, color = VAR.line, dash = '4 4', strokeWidth = 1 }: ReferenceLineProps) {
  const ctx = useCartesianChart();
  const { plot } = ctx;
  if (dataY !== undefined) {
    const y = ctx.y(dataY);
    if (y < plot.top - 0.5 || y > plot.bottom + 0.5) return null;
    const pos = labelPosition ?? 'right';
    const tx = pos === 'left' ? plot.left + 4 : pos === 'center' ? (plot.left + plot.right) / 2 : plot.right - 4;
    const anchor = pos === 'left' ? 'start' : pos === 'center' ? 'middle' : 'end';
    return (
      <g pointerEvents="none">
        <line x1={plot.left} x2={plot.right} y1={y} y2={y} strokeWidth={strokeWidth} strokeDasharray={dash || undefined} shapeRendering="crispEdges" style={{ stroke: color }} />
        {label !== undefined && (
          <text x={tx} y={y - 5} textAnchor={anchor} fontSize={11} fontWeight={600} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" style={{ stroke: VAR.bg, fill: color === VAR.line ? VAR.text : color }}>
            {label}
          </text>
        )}
      </g>
    );
  }
  if (dataX !== undefined) {
    const x = ctx.x(dataX);
    const pos = labelPosition ?? 'top';
    return (
      <g pointerEvents="none">
        <line x1={x} x2={x} y1={plot.top} y2={plot.bottom} strokeWidth={strokeWidth} strokeDasharray={dash || undefined} shapeRendering="crispEdges" style={{ stroke: color }} />
        {label !== undefined && (
          <text
            x={x + 4}
            y={pos === 'bottom' ? plot.bottom - 4 : plot.top + 11}
            fontSize={11}
            fontWeight={600} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" style={{ stroke: VAR.bg, fill: color === VAR.line ? VAR.text : color }}>
            {label}
          </text>
        )}
      </g>
    );
  }
  return null;
}

export interface PointProps {
  /** X index. */
  dataX: number;
  /** Value. Omit with `seriesId` to sit on that series. */
  dataY?: number;
  seriesId?: string;
  color?: string;
  radius?: number;
  /** Text next to the point (e.g. "매수", "고점 12,400"). */
  label?: string;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Live-price beacon. */
  pulse?: boolean;
  onClick?: () => void;
}

/** A marker at a data position: trades on a price line, highs/lows, the latest value. */
export function Point({ dataX, dataY, seriesId, color, radius = 4, label, labelPosition = 'top', pulse = false, onClick }: PointProps) {
  const ctx = useCartesianChart();
  const s = seriesId ? ctx.getSeries(seriesId) : undefined;
  const value = dataY ?? (s ? s.data[dataX] : undefined);
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const st = s ? ctx.stacked?.get(s.id) : undefined;
  const x = ctx.x(dataX);
  const y = ctx.y(st && dataY === undefined ? st.y1[dataX]! : value);
  const fill = color ?? s?.color ?? ctx.series[0]?.color ?? 'currentColor';
  const gap = radius + 6;
  const [lx, ly, anchor]: [number, number, 'start' | 'middle' | 'end'] =
    labelPosition === 'bottom'
      ? [x, y + gap + 8, 'middle']
      : labelPosition === 'left'
        ? [x - gap, y + 4, 'end']
        : labelPosition === 'right'
          ? [x + gap, y + 4, 'start']
          : [x, y - gap, 'middle'];
  return (
    <g style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick} pointerEvents={onClick ? 'auto' : 'none'}>
      {pulse && (
        <circle cx={x} cy={y} r={radius} fillOpacity={0.35} style={{ fill: fill }}>
          <animate attributeName="r" values={`${radius};${radius * 3.2}`} dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.35;0" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={x} cy={y} r={radius} strokeWidth={2} style={{ fill: fill, stroke: VAR.bg }} />
      {label !== undefined && (
        <text x={lx} y={ly} textAnchor={anchor} fontSize={11} fontWeight={600} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" style={{ stroke: VAR.bg, fill: fill }}>
          {label}
        </text>
      )}
    </g>
  );
}

/** Label for a value in the default number format (exported for custom annotations). */
export const formatValue = formatNumber;
