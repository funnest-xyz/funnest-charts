import { formatNumber, scaleFor, useCartesianChart, VAR } from './context';

export interface ReferenceLineProps {
  /** Horizontal line at this value (target price, average entry, 0%). */
  dataY?: number;
  /** Vertical line at this x index (event, earnings date). */
  dataX?: number;
  /** For `dataY` with several y axes: which axis the value belongs to. */
  yAxisId?: string;
  label?: string;
  /** Where the label sits along the line. Default 'right' (horizontal) / 'top' (vertical). */
  labelPosition?: 'left' | 'right' | 'center' | 'top' | 'bottom';
  /** Horizontal lines: label above (default), below or centered on the line. */
  labelAlign?: 'above' | 'below' | 'center';
  /** 'text' (default) or 'pill': text on a filled badge in the line color. */
  labelStyle?: 'text' | 'pill';
  /** Nudge the label, px. */
  labelDx?: number;
  labelDy?: number;
  color?: string;
  /** Dash pattern; '' for a solid line. Default '4 4'. */
  dash?: string;
  strokeWidth?: number;
}

const LABEL_FONT = 11;
const labelWidth = (t: string) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? LABEL_FONT : LABEL_FONT * 0.62), 0);

/** A label as plain text with a halo, or as a filled pill. */
function LineLabel(props: { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; color: string; pill: boolean }) {
  const { x, y, text, anchor, color, pill } = props;
  const textColor = color === VAR.line ? VAR.text : color;
  if (!pill) {
    return (
      <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontSize={LABEL_FONT} fontWeight={600} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" style={{ stroke: VAR.bg, fill: textColor }}>
        {text}
      </text>
    );
  }
  const w = labelWidth(text) + 14;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return (
    <g>
      <rect x={left} y={y - 10} width={w} height={20} rx={10} style={{ fill: color === VAR.line ? VAR.textStrong : color }} />
      <text x={left + w / 2} y={y} textAnchor="middle" dominantBaseline="central" fontSize={LABEL_FONT} fontWeight={700} style={{ fill: VAR.bg }}>
        {text}
      </text>
    </g>
  );
}

export function ReferenceLine({
  dataY,
  dataX,
  yAxisId,
  label,
  labelPosition,
  labelAlign = 'above',
  labelStyle = 'text',
  labelDx = 0,
  labelDy = 0,
  color = VAR.line,
  dash = '4 4',
  strokeWidth = 1,
}: ReferenceLineProps) {
  const ctx = useCartesianChart();
  const { plot } = ctx;
  const pill = labelStyle === 'pill';
  if (dataY !== undefined) {
    const y = scaleFor(ctx, yAxisId)(dataY);
    if (y < plot.top - 0.5 || y > plot.bottom + 0.5) return null;
    const pos = labelPosition ?? 'right';
    const tx = pos === 'left' ? plot.left + 4 : pos === 'center' ? (plot.left + plot.right) / 2 : plot.right - 4;
    const anchor = pos === 'left' ? 'start' : pos === 'center' ? 'middle' : 'end';
    const off = pill ? 13 : 9;
    const ly = labelAlign === 'center' ? y : labelAlign === 'below' ? y + off : y - off;
    return (
      <g pointerEvents="none">
        <line x1={plot.left} x2={plot.right} y1={y} y2={y} strokeWidth={strokeWidth} strokeDasharray={dash || undefined} shapeRendering="crispEdges" style={{ stroke: color }} />
        {label !== undefined && <LineLabel x={tx + labelDx} y={ly + labelDy} text={label} anchor={anchor} color={color} pill={pill} />}
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
          <LineLabel
            x={x + (pill ? 0 : 4) + labelDx}
            y={(pos === 'bottom' ? plot.bottom - 10 : plot.top + 10) + labelDy}
            text={label}
            anchor={pill ? 'middle' : 'start'}
            color={color}
            pill={pill}
          />
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
  /** For `dataY` without `seriesId` and several y axes: the axis of the value. */
  yAxisId?: string;
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
export function Point({ dataX, dataY, seriesId, yAxisId, color, radius = 4, label, labelPosition = 'top', pulse = false, onClick }: PointProps) {
  const ctx = useCartesianChart();
  const s = seriesId ? ctx.getSeries(seriesId) : undefined;
  const value = dataY ?? (s ? s.data[dataX] : undefined);
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const st = s ? ctx.stacked?.get(s.id) : undefined;
  const x = ctx.x(dataX);
  const y = (s?.scale ?? scaleFor(ctx, yAxisId))(st && dataY === undefined ? st.y1[dataX]! : value);
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
