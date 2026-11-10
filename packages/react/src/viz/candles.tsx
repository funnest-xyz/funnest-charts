import type { ReactNode } from 'react';
import { XAxis, YAxis, type XAxisProps, type YAxisProps } from './axes';
import { BarPlot } from './bar';
import { CartesianChart, type CartesianChartProps } from './cartesian-chart';
import { formatNumber, scaleFor, useCartesianChart, VAR } from './context';

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandlePlotProps {
  data: readonly (Candle | null)[];
  /** Axis the prices are on (when the chart has several). */
  yAxisId?: string;
  /** Default '#F04452' (Korean red-up). */
  upColor?: string;
  /** Default '#3182F6'. */
  downColor?: string;
  /** Body width as a share of the slot. Default 0.7. */
  bodyWidth?: number;
  /** Hollow bodies for up candles. Default false. */
  hollowUp?: boolean;
  /** Pointer line + OHLC tooltip while scrubbing. Default true. */
  tooltip?: boolean;
  /** Tooltip row names. Default 시가/고가/저가/종가 (Korean) — pass English if needed. */
  labels?: { open: string; high: string; low: string; close: string; volume?: string };
  valueFormatter?: (value: number) => string;
}

const KO = { open: '시가', high: '고가', low: '저가', close: '종가', volume: '거래량' };

/** Translucent version of a color: rgba() for #rrggbb (works in PNG renderers too), color-mix otherwise. */
const fade = (color: string, a: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Candles (wick + body) for each x slot. Needs a band x axis and a y axis that covers low–high. */
export function CandlePlot({
  data,
  yAxisId,
  upColor = '#F04452',
  downColor = '#3182F6',
  bodyWidth = 0.7,
  hollowUp = false,
  tooltip = true,
  labels = KO,
  valueFormatter = formatNumber,
}: CandlePlotProps) {
  const ctx = useCartesianChart();
  const band = ctx.band;
  if (!band) return null;
  const y = scaleFor(ctx, yAxisId);
  const bw = Math.max(1, Math.min(band.step * bodyWidth, band.step - 1));
  const i = ctx.scrubIndex;
  const scrubbed = i !== null ? data[i] : null;

  let tip: ReactNode = null;
  if (tooltip && i !== null && scrubbed) {
    const prev = i > 0 ? data[i - 1] : null;
    const base = prev?.close ?? scrubbed.open;
    const chg = base ? ((scrubbed.close - base) / base) * 100 : 0;
    const rows: [string, string, (string | undefined)?][] = [
      [labels.open, valueFormatter(scrubbed.open)],
      [labels.high, valueFormatter(scrubbed.high), upColor],
      [labels.low, valueFormatter(scrubbed.low), downColor],
      [labels.close, `${valueFormatter(scrubbed.close)} (${chg > 0 ? '+' : ''}${chg.toFixed(2)}%)`, chg > 0 ? upColor : chg < 0 ? downColor : undefined],
    ];
    if (scrubbed.volume !== undefined) rows.push([labels.volume ?? KO.volume, formatNumber(scrubbed.volume)]);
    const width = (s: string) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 12 : 7.2), 0);
    const tw = Math.max(...rows.map(([a, b]) => width(a) + width(b) + 24)) + 8;
    const th = rows.length * 18 + 14;
    const x = band.center(i);
    const right = x + 12 + tw <= ctx.plot.right;
    tip = (
      <g pointerEvents="none">
        <line x1={x} x2={x} y1={ctx.plot.top} y2={ctx.plot.bottom} strokeWidth={1} shapeRendering="crispEdges" style={{ stroke: VAR.line }} />
        <g transform={`translate(${right ? x + 12 : x - 12 - tw},${ctx.plot.top + 4})`}>
          <rect width={tw} height={th} rx={8} strokeWidth={1} style={{ fill: VAR.bg, stroke: VAR.grid }} />
          {rows.map(([a, b, color], k) => (
            <g key={a} transform={`translate(10,${16 + k * 18})`}>
              <text dominantBaseline="central" fontSize={12} style={{ fill: VAR.text }}>
                {a}
              </text>
              <text x={tw - 20} textAnchor="end" dominantBaseline="central" fontSize={12} fontWeight={700} style={{ fill: color ?? VAR.textStrong, fontVariantNumeric: 'tabular-nums' }}>
                {b}
              </text>
            </g>
          ))}
        </g>
      </g>
    );
  }

  return (
    <g>
      {data.map((d, k) => {
        if (!d) return null;
        const up = d.close >= d.open;
        const color = up ? upColor : downColor;
        const cx = Math.round(band.center(k)) + 0.5;
        const top = y(Math.max(d.open, d.close));
        const bottom = y(Math.min(d.open, d.close));
        const h = Math.max(1, bottom - top);
        const hollow = hollowUp && up && bw >= 4;
        return (
          <g key={k} opacity={i !== null && i !== k ? 0.55 : 1}>
            <line x1={cx} x2={cx} y1={y(d.high)} y2={y(d.low)} strokeWidth={1} style={{ stroke: color }} />
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={h}
              rx={Math.min(1.5, bw / 4)}
              strokeWidth={hollow ? 1 : 0}
              style={hollow ? { fill: VAR.bg, stroke: color } : { fill: color }}
            />
          </g>
        );
      })}
      {tip}
    </g>
  );
}

type AxisToggle<P> = boolean | P;
const axisProps = <P,>(v: AxisToggle<P> | undefined): P | null => (v ? (v === true ? ({} as P) : v) : null);

export interface CandlestickChartProps
  extends Omit<CartesianChartProps, 'series' | 'yAxis' | 'stacked' | 'children' | 'legend'>,
    Pick<CandlePlotProps, 'upColor' | 'downColor' | 'bodyWidth' | 'hollowUp' | 'labels' | 'valueFormatter'> {
  data: readonly (Candle | null)[];
  /** Volume bars along the bottom (from `data[i].volume`). Default true when volumes exist. */
  showVolume?: boolean;
  /** Share of the height the volume bars may use. Default 0.22. */
  volumeHeight?: number;
  /** Default true (right side). */
  showYAxis?: AxisToggle<YAxisProps>;
  showXAxis?: AxisToggle<XAxisProps>;
  /** Pointer line + OHLC tooltip. Default true. */
  tooltip?: boolean;
  /** ReferenceLine (use `yAxisId="price"`), Point, … */
  children?: ReactNode;
}

/**
 * A small candlestick chart in SVG for cards and dashboards (the full trading chart is `FnChart`).
 * Prices sit on axis "price", volume on axis "volume".
 */
export function CandlestickChart({
  data,
  showVolume,
  volumeHeight = 0.22,
  showYAxis = true,
  showXAxis,
  tooltip = true,
  upColor = '#F04452',
  downColor = '#3182F6',
  bodyWidth,
  hollowUp,
  labels,
  valueFormatter = formatNumber,
  xAxis,
  children,
  getScrubberAccessibilityLabel,
  ...chart
}: CandlestickChartProps) {
  const hasVolume = showVolume ?? data.some((d) => d?.volume !== undefined);
  const maxVol = Math.max(0, ...data.map((d) => d?.volume ?? 0));
  // Prices keep clear of the volume band: stretch the price axis down by that share.
  const lows = data.flatMap((d) => (d ? [d.low] : []));
  const highs = data.flatMap((d) => (d ? [d.high] : []));
  const lo = lows.length ? Math.min(...lows) : 0;
  const hi = highs.length ? Math.max(...highs) : 1;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.04;
  const share = hasVolume ? Math.min(0.6, Math.max(0.05, volumeHeight)) : 0;
  const priceMin = lo - pad - ((hi - lo + 2 * pad) * share) / (1 - share);
  const yAx = axisProps(showYAxis);
  const xAx = axisProps(showXAxis);
  const l = labels ?? KO;
  return (
    <CartesianChart
      enableScrubbing={tooltip}
      {...chart}
      xAxis={{ bandPadding: 0.2, ...xAxis, scaleType: 'band' }}
      series={[
        { id: 'price', data: data.map((d) => (d ? ([d.low, d.high] as const) : null)), yAxisId: 'price', color: upColor },
        ...(hasVolume ? [{ id: 'volume', data: data.map((d) => d?.volume ?? null), yAxisId: 'volume', color: 'color-mix(in srgb, CanvasText 18%, transparent)' }] : []),
      ]}
      yAxis={[
        { id: 'price', includeZero: false, domain: { min: priceMin, max: hi + pad } },
        // Volume keeps to the bottom band: its axis is stretched so the tallest bar reaches volumeHeight.
        { id: 'volume', domain: { min: 0, max: maxVol > 0 ? maxVol / Math.max(0.05, volumeHeight) : 1 } },
      ]}
      getScrubberAccessibilityLabel={
        getScrubberAccessibilityLabel ??
        ((i) => {
          const d = data[i];
          return d ? `${l.open} ${valueFormatter(d.open)}, ${l.high} ${valueFormatter(d.high)}, ${l.low} ${valueFormatter(d.low)}, ${l.close} ${valueFormatter(d.close)}` : '';
        })
      }
    >
      {yAx && <YAxis key="y" tickLabelFormatter={valueFormatter} {...yAx} axisId="price" />}
      {xAx && <XAxis key="x" {...xAx} />}
      {hasVolume && (
        <BarPlot
          seriesIds={['volume']}
          radius={1}
          highlightScrubbed={false}
          getBarColor={(_v, i) => {
            const d = data[i];
            return d ? fade(d.close >= d.open ? upColor : downColor, 0.3) : undefined;
          }}
        />
      )}
      <CandlePlot
        data={data}
        yAxisId="price"
        upColor={upColor}
        downColor={downColor}
        tooltip={tooltip}
        labels={l}
        valueFormatter={valueFormatter}
        {...(bodyWidth !== undefined ? { bodyWidth } : {})}
        {...(hollowUp !== undefined ? { hollowUp } : {})}
      />
      {children}
    </CartesianChart>
  );
}
