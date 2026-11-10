import { formatNumber, seriesY, useCartesianChart, VAR } from './context';

export interface ScrubberProps {
  /** Text above the scrub line. Default: the x label (`xAxis.data[index]`). Return '' to hide. */
  label?: (index: number) => string;
  /** Only mark these series (default: all). */
  seriesIds?: readonly string[];
  /** Dim the part of each line right of the scrubber. Default true. */
  dimFuture?: boolean;
  /** Same as `dimFuture={false}`. */
  hideOverlay?: boolean;
  /** While idle (not scrubbing), pulse a beacon on each series' latest point. */
  idlePulse?: boolean;
  /** Value labels beside each beacon (true, or a formatter). Default false. */
  beaconLabels?: boolean | ((value: number, seriesId: string) => string);
  /** Beacon color per value (e.g. up/down around a baseline). Default: the series color. */
  beaconColor?: (value: number, seriesId: string) => string;
  /** Tooltip with each series' value at the scrubbed index. Default false. */
  showValues?: boolean;
  /** Format tooltip values. */
  valueFormatter?: (value: number, seriesId: string) => string;
}

const TIP_FONT = 12;
const ROW = 18;
const TIP_PAD = 7;
const textWidth = (t: string) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? TIP_FONT : TIP_FONT * 0.6), 0);

/**
 * Pointer-follow overlay: vertical line, a dot on each series and a label. Requires
 * `enableScrubbing` on the chart. Read the index yourself with `onScrubberPositionChange`
 * to drive a header (price / change at that point).
 */
export function Scrubber({
  label,
  seriesIds,
  dimFuture = true,
  hideOverlay = false,
  idlePulse = false,
  beaconLabels = false,
  beaconColor,
  showValues = false,
  valueFormatter = formatNumber,
}: ScrubberProps) {
  const ctx = useCartesianChart();
  const i = ctx.scrubIndex;
  const pick = seriesIds ? ctx.series.filter((s) => seriesIds.includes(s.id)) : ctx.series;
  const colorOf = (s: (typeof pick)[number], v: number) => beaconColor?.(v, s.id) ?? s.color;

  if (i === null || i >= ctx.length) {
    if (!idlePulse || ctx.band) return null;
    // Idle: a pulsing beacon on each series' latest value.
    return (
      <g pointerEvents="none">
        {pick.map((s) => {
          let last = s.data.length - 1;
          while (last >= 0 && (s.data[last] === null || s.data[last] === undefined)) last--;
          if (last < 0) return null;
          const y = seriesY(ctx, s, last);
          if (y === null) return null;
          const x = ctx.x(last);
          const color = colorOf(s, s.data[last]!);
          return (
            <g key={s.id}>
              <circle cx={x} cy={y} r={4} fillOpacity={0.35} style={{ fill: color }}>
                <animate attributeName="r" values="4;13" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="fill-opacity" values="0.35;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r={4} strokeWidth={2} style={{ fill: color, stroke: VAR.bg }} />
            </g>
          );
        })}
      </g>
    );
  }
  const { plot } = ctx;
  const x = ctx.x(i);
  const text = label ? label(i) : ctx.xLabel(i);
  const list = pick;
  const textX = Math.min(Math.max(x, plot.left + 30), plot.right - 30);

  // Value tooltip: one row per series, beside the line (flips left near the right edge).
  const rows = showValues
    ? list.flatMap((s) => {
        const v = s.data[i];
        if (v === null || v === undefined || !Number.isFinite(v)) return [];
        // Ranges read "low – high".
        const lo = s.low?.[i];
        const text = lo !== null && lo !== undefined && lo !== v ? `${valueFormatter(lo, s.id)} – ${valueFormatter(v, s.id)}` : valueFormatter(v, s.id);
        return [{ s, text }];
      })
    : [];
  const tipW = Math.max(0, ...rows.map((r) => textWidth(r.text) + (rows.length > 1 || r.s.label ? textWidth(r.s.label ?? '') + 26 : 18))) + 16;
  // Each row is ROW px tall and centered on its own middle line; equal padding all round.
  const tipH = rows.length * ROW + TIP_PAD * 2;
  const tipRight = x + 12 + tipW <= plot.right;
  const tipX = tipRight ? x + 12 : x - 12 - tipW;
  const tipY = plot.top + 4;

  return (
    <g pointerEvents="none">
      {dimFuture && !hideOverlay && !ctx.band && (
        <rect x={x} y={plot.top} width={Math.max(0, plot.right - x + 2)} height={plot.height} fillOpacity={0.55} style={{ fill: VAR.bg }} />
      )}
      <line x1={x} x2={x} y1={plot.top} y2={plot.bottom} strokeWidth={1} shapeRendering="crispEdges" style={{ stroke: VAR.line }} />
      {text && (
        <text x={textX} y={Math.max(11, plot.top - 2)} textAnchor="middle" fontSize={11} fontWeight={600} strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" style={{ stroke: VAR.bg, fill: VAR.textStrong }}>
          {text}
        </text>
      )}
      {!ctx.band &&
        list.map((s) => {
          const y = seriesY(ctx, s, i);
          if (y === null) return null;
          const v = s.data[i]!;
          const color = colorOf(s, v);
          const text = beaconLabels ? (typeof beaconLabels === 'function' ? beaconLabels(v, s.id) : valueFormatter(v, s.id)) : '';
          // Beacon labels sit right of the dot, or left near the right edge.
          const right = x + 12 + textWidth(text) <= plot.right;
          return (
            <g key={s.id}>
              <circle cx={x} cy={y} r={7} fillOpacity={0.18} style={{ fill: color }} />
              <circle cx={x} cy={y} r={4} strokeWidth={2} style={{ fill: color, stroke: VAR.bg }} />
              {text && (
                <text
                  x={right ? x + 10 : x - 10}
                  y={y}
                  textAnchor={right ? 'start' : 'end'}
                  dominantBaseline="central"
                  fontSize={TIP_FONT}
                  fontWeight={700}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  style={{ fill: color, stroke: VAR.bg, fontVariantNumeric: 'tabular-nums' }}
                >
                  {text}
                </text>
              )}
            </g>
          );
        })}
      {rows.length > 0 && (
        <g transform={`translate(${tipX},${tipY})`}>
          <rect width={tipW} height={tipH} rx={8} style={{ fill: VAR.bg, stroke: VAR.grid }} strokeWidth={1} />
          {rows.map((r, k) => (
            <g key={r.s.id} transform={`translate(10,${TIP_PAD + ROW / 2 + k * ROW})`}>
              <circle cx={3} cy={0} r={3} style={{ fill: r.s.color }} />
              {(rows.length > 1 || r.s.label) && (
                <text x={12} dominantBaseline="central" fontSize={TIP_FONT} style={{ fill: VAR.text }}>
                  {r.s.label ?? r.s.id}
                </text>
              )}
              <text x={tipW - 20} textAnchor="end" dominantBaseline="central" fontSize={TIP_FONT} fontWeight={700} style={{ fill: VAR.textStrong, fontVariantNumeric: 'tabular-nums' }}>
                {r.text}
              </text>
            </g>
          ))}
        </g>
      )}
    </g>
  );
}
