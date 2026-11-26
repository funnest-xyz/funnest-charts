import type { Locale } from '../model/time-format.js';
import type { Bar } from '../types.js';
import { bollinger, ema, macd, rsi, sma } from './math.js';

/** Built-in indicators. */
export type BuiltinIndicatorType = 'ma' | 'ema' | 'bb' | 'rsi' | 'macd';
/** A built-in type, or the `type` of a definition passed in `ChartOptions.indicators`. */
export type IndicatorType = BuiltinIndicatorType | (string & {});

/** Which price an indicator reads from each bar. */
export type PriceSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

export const PRICE_SOURCES: { value: PriceSource; label: Record<Locale, string> }[] = [
  { value: 'close', label: { ko: '종가', en: 'Close' } },
  { value: 'open', label: { ko: '시가', en: 'Open' } },
  { value: 'high', label: { ko: '고가', en: 'High' } },
  { value: 'low', label: { ko: '저가', en: 'Low' } },
  { value: 'hl2', label: { ko: '(고+저)/2', en: '(H+L)/2' } },
  { value: 'hlc3', label: { ko: '(고+저+종)/3', en: '(H+L+C)/3' } },
  { value: 'ohlc4', label: { ko: '(시+고+저+종)/4', en: '(O+H+L+C)/4' } },
];

/** One moving-average line: period + source. Its color/width/visibility live in the config's `styles`. */
export interface MaLine {
  period: number;
  source: PriceSource;
}

export type IndicatorParamValue = number | string | MaLine[];
export type IndicatorParams = Record<string, IndicatorParamValue>;

export interface IndicatorParamSpec {
  key: string;
  label: Record<Locale, string>;
  /** 'lines' = a list of {period, source} rows (moving averages). */
  kind: 'number' | 'source' | 'lines';
  min?: number;
  max?: number;
  step?: number;
}

/** Per-series overrides set by the user. */
export interface SeriesStyle {
  color?: string;
  /** Line width in CSS px. */
  width?: number;
  visible?: boolean;
  /** Lines: solid, dashed or dotted. */
  lineStyle?: LineStyle;
  /** How it's drawn instead of the indicator's own way (a line as columns, steps, dots…). */
  kind?: SeriesKind;
}

/**
 * Colors in indicator output: any canvas color, a CSS variable (`var(--x)`), or `'up'` / `'down'`
 * — the chart's own rising / falling colors (they follow the theme and the user's settings).
 */
export type IndicatorColor = string;

/** A color per bar, compactly: `index[i]` picks from `palette`; 255 = the default color (or nothing). */
export interface BarColors {
  palette: IndicatorColor[];
  index: Uint8Array;
}

export type LineStyle = 'solid' | 'dotted' | 'dashed';

/**
 * How a series is drawn. 'histogram' bars from zero colored by sign (unless `colors` is given);
 * 'columns' bars from zero in the series' color; 'step' a staircase line; 'area' a line with a
 * shade down to the pane's bottom; 'circles' / 'cross' a mark per value.
 */
export type SeriesKind = 'line' | 'histogram' | 'columns' | 'step' | 'area' | 'circles' | 'cross';

export interface IndicatorSeries {
  key: string;
  label: string;
  values: Float64Array;
  /** Ignored for histograms without `colors`, which are colored up/down by sign. */
  color: IndicatorColor;
  width: number;
  visible: boolean;
  kind: SeriesKind;
  /**
   * Draw `values[i]` this many bars to the right (Ichimoku spans lead by 25). Points past the
   * last bar land in the empty space on the right. Default 0.
   */
  shift?: number;
  /** A color per bar (a line's segment ending on that bar); 255 keeps `color`. */
  colors?: BarColors;
  /** Lines only. Default 'solid'. */
  lineStyle?: LineStyle;
}

/**
 * Shaded area between two series (Bollinger band). With `downColor`, stretches where `lower` is
 * above `upper` use it instead (Ichimoku cloud); with `colors`, each bar's own color (255: none).
 * Painted see-through.
 */
export interface IndicatorFill {
  upper: string;
  lower: string;
  color: IndicatorColor;
  downColor?: IndicatorColor;
  colors?: BarColors;
}

/** A horizontal reference line: a value, or a value with its own color, name and style. */
export type IndicatorLevel = number | { value: number; color?: IndicatorColor; label?: string; style?: LineStyle; width?: number };

/** Where a mark sits: over the bar's high / under its low (on a price pane), at a price, or at the pane's top / bottom. */
export type MarkLocation = 'above' | 'below' | 'price' | 'top' | 'bottom';
export type MarkShape = 'triangleup' | 'triangledown' | 'arrowup' | 'arrowdown' | 'circle' | 'square' | 'diamond' | 'cross' | 'xcross' | 'flag';
export type MarkSize = 'tiny' | 'small' | 'normal' | 'large';
/** Where a line or box keeps going: past its right end, left end, or both (to the pane's edges). */
export type Extend = 'none' | 'left' | 'right' | 'both';
export type TablePosition = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

/**
 * Free-form things an indicator draws in its pane (a script's plotshape / label / line / box /
 * table…). Bars are data indices — past the last bar is the empty space on the right — and
 * prices are in the pane's units.
 */
export interface IndicatorGraphics {
  /** Bars shaded behind everything in the pane (one entry per layer, a color per bar; 255 = none). */
  backgrounds?: { colors: BarColors }[];
  /** A mark on every bar where `when` is 1. */
  shapes?: {
    when: Uint8Array;
    shape: MarkShape;
    location: MarkLocation;
    /** With location 'price': where, per bar. */
    price?: Float64Array;
    color: IndicatorColor;
    text?: string;
    textColor?: IndicatorColor;
    size: MarkSize;
  }[];
  labels?: {
    bar: number;
    text: string;
    location: MarkLocation;
    price?: number;
    /** The box's color ('box'), or the text's ('text'). */
    color?: IndicatorColor;
    textColor?: IndicatorColor;
    /** 'box' text in a filled box; 'text' text only. */
    style: 'box' | 'text';
    /** Which side of the point the label grows to: 'right' starts at it (text to its right). */
    align: 'left' | 'center' | 'right';
    size: MarkSize;
  }[];
  lines?: { x1: number; y1: number; x2: number; y2: number; color: IndicatorColor; width: number; style: LineStyle; extend: Extend }[];
  boxes?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    /** Border; omit for none. */
    color?: IndicatorColor;
    /** Fill (painted as given: say the alpha with #rrggbbaa). */
    bg?: IndicatorColor;
    width: number;
    style: LineStyle;
    extend: Extend;
    text?: string;
    textColor?: IndicatorColor;
  }[];
  /** Tables pinned to a corner / edge of the pane (dashboards). */
  tables?: {
    position: TablePosition;
    rows: { text: string; color?: IndicatorColor; bg?: IndicatorColor; align?: 'left' | 'center' | 'right' }[][];
    bg?: IndicatorColor;
    textColor?: IndicatorColor;
    border?: IndicatorColor;
    size: MarkSize;
  }[];
}

export interface IndicatorOutput {
  series: IndicatorSeries[];
  /** Shaded area between two series (see IndicatorFill). */
  fill?: IndicatorFill;
  /** More fills, drawn after `fill`. */
  fills?: IndicatorFill[];
  /** Horizontal reference lines (RSI 30/70). */
  levels?: IndicatorLevel[];
  /** Fixed value range instead of auto-scaling (RSI 0–100). */
  range?: [number, number];
  /** Decimals for labels; null = the symbol's price precision. */
  precision: number | null;
  /** Indicators over the candles: a candle color per bar (255 keeps the candle's own). */
  barColors?: BarColors;
  /** Shapes, labels, lines, boxes, tables, backgrounds. */
  graphics?: IndicatorGraphics;
}

export interface IndicatorDefinition {
  type: IndicatorType;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  /** Drawn over the candles (true) or in its own pane below (false). */
  overlay: boolean;
  params: IndicatorParamSpec[];
  defaults: IndicatorParams;
  title(params: IndicatorParams): string;
  compute(bars: readonly Bar[], params: IndicatorParams): IndicatorOutput;
  /**
   * How many bars before a bar its value depends on (to within 0.1%): the chart keeps at least
   * this many loaded left of the screen, so what's shown doesn't depend on how far back it
   * happened to load (an EMA 200 from 300 bars still leans a third on its starting guess — a
   * small gap in price, but enough to move where two lines cross). Omitted: nothing extra.
   */
  lookback?(params: IndicatorParams): number;
  /**
   * Can sit on another indicator (지표 위에 지표: an MA over RSI), reading that one's series as
   * its price — for types that read one price per bar (moving averages, bands).
   */
  onIndicator?: boolean;
  /**
   * Left out of the indicator picker: added only from code (e.g. an app's user scripts, whose
   * params say which script). Charts that already have it show and save it as usual.
   */
  hidden?: boolean;
}

/**
 * Bars an EMA needs behind a value: its SMA seed, then until the seed's weight is under 0.1%
 * ((1 − 2/(n+1))^k < 0.001 → k ≈ 3.45·(n+1)).
 */
export const emaLookback = (period: number) => Math.ceil(period + 3.5 * (period + 1));
/**
 * The longest 이동평균 / 지수이동평균 period (1792일선 and other long ones): as many bars as the chart
 * keeps loaded behind the screen for indicators (MAX_INDICATOR_LOOKBACK in chart.ts).
 */
export const MAX_MA_PERIOD = 5000;
/** Wilder's smoothing (RSI): weight 1/n, so k ≈ 6.9·n after the seed. */
export const wilderLookback = (period: number) => Math.ceil(period + 7 * period);

/** Distinct line colors that avoid the up/down candle colors. */
export const SERIES_COLORS = ['#12B886', '#FF9F0A', '#7048E8', '#8B95A1', '#F06595', '#15AABF', '#3182F6', '#795548'];

export function priceSource(bars: readonly Bar[], source: PriceSource = 'close'): Float64Array {
  switch (source) {
    case 'open':
      return Float64Array.from(bars, (b) => b.open);
    case 'high':
      return Float64Array.from(bars, (b) => b.high);
    case 'low':
      return Float64Array.from(bars, (b) => b.low);
    case 'hl2':
      return Float64Array.from(bars, (b) => (b.high + b.low) / 2);
    case 'hlc3':
      return Float64Array.from(bars, (b) => (b.high + b.low + b.close) / 3);
    case 'ohlc4':
      return Float64Array.from(bars, (b) => (b.open + b.high + b.low + b.close) / 4);
    default:
      return Float64Array.from(bars, (b) => b.close);
  }
}

const num = (p: IndicatorParams, key: string) => Number(p[key]);
const src = (p: IndicatorParams) => (typeof p.source === 'string' ? (p.source as PriceSource) : 'close');
const SOURCE_SHORT: Record<PriceSource, string> = { close: '', open: 'O', high: 'H', low: 'L', hl2: 'HL2', hlc3: 'HLC3', ohlc4: 'OHLC4' };

/** Reads `lines`, accepting the legacy `periods: number[]` shape too. */
export function maLines(p: IndicatorParams): MaLine[] {
  const raw = Array.isArray(p.lines) ? p.lines : Array.isArray(p.periods) ? (p.periods as unknown as number[]).map((period) => ({ period, source: 'close' as const })) : [];
  return raw
    .map((l) => ({ period: Math.round(Number(l.period)), source: (l.source ?? 'close') as PriceSource }))
    .filter((l) => Number.isFinite(l.period) && l.period > 0);
}

const line = (key: string, label: string, values: Float64Array, color: string): IndicatorSeries => ({
  key,
  label,
  values,
  color,
  width: 1,
  visible: true,
  kind: 'line',
});

function movingAverages(bars: readonly Bar[], p: IndicatorParams, prefix: string, fn: typeof sma, colors: string[]): IndicatorOutput {
  const cache = new Map<PriceSource, Float64Array>();
  return {
    series: maLines(p).map((l, i) => {
      let values = cache.get(l.source);
      if (!values) cache.set(l.source, (values = priceSource(bars, l.source)));
      const suffix = SOURCE_SHORT[l.source] ? `(${SOURCE_SHORT[l.source]})` : '';
      // Keyed by row index so styles survive period edits.
      return line(`l${i}`, `${prefix}${l.period}${suffix}`, fn(values, l.period), colors[i % colors.length]!);
    }),
    precision: null,
  };
}

const PARAM = (ko: string, en: string): IndicatorParamSpec['label'] => ({ ko, en });
const SOURCE_PARAM: IndicatorParamSpec = { key: 'source', label: PARAM('가격 기준', 'Source'), kind: 'source' };

export const INDICATORS: Record<BuiltinIndicatorType, IndicatorDefinition> = {
  ma: {
    type: 'ma',
    name: { ko: '이동평균선', en: 'Moving Average' },
    description: { ko: '단순 이동평균 (5·20·60·120)', en: 'Simple moving averages' },
    overlay: true,
    params: [{ key: 'lines', label: PARAM('기간', 'Period'), kind: 'lines', min: 1, max: MAX_MA_PERIOD }],
    defaults: {
      lines: [5, 20, 60, 120].map((period) => ({ period, source: 'close' as const })),
    },
    title: (p) => `MA ${maLines(p).map((l) => l.period).join('·')}`,
    compute: (bars, p) => movingAverages(bars, p, 'MA', sma, SERIES_COLORS),
    onIndicator: true,
    lookback: (p) => Math.max(0, ...maLines(p).map((l) => l.period)),
  },
  ema: {
    type: 'ema',
    name: { ko: '지수이동평균', en: 'Exponential MA' },
    description: { ko: '최근 가격에 가중치를 둔 이동평균', en: 'Moving average weighted to recent prices' },
    overlay: true,
    params: [{ key: 'lines', label: PARAM('기간', 'Period'), kind: 'lines', min: 1, max: MAX_MA_PERIOD }],
    defaults: { lines: [12, 26].map((period) => ({ period, source: 'close' as const })) },
    title: (p) => `EMA ${maLines(p).map((l) => l.period).join('·')}`,
    compute: (bars, p) => movingAverages(bars, p, 'EMA', ema, ['#3182F6', '#F06595', '#15AABF', '#FF9F0A']),
    onIndicator: true,
    lookback: (p) => Math.max(0, ...maLines(p).map((l) => emaLookback(l.period))),
  },
  bb: {
    type: 'bb',
    name: { ko: '볼린저밴드', en: 'Bollinger Bands' },
    description: { ko: '이동평균 ± 표준편차 밴드', en: 'Moving average ± standard deviations' },
    overlay: true,
    params: [
      { key: 'period', label: PARAM('기간', 'Period'), kind: 'number', min: 2, max: 500 },
      { key: 'mult', label: PARAM('승수', 'Multiplier'), kind: 'number', min: 0.1, max: 10, step: 0.1 },
      SOURCE_PARAM,
    ],
    defaults: { period: 20, mult: 2, source: 'close' },
    title: (p) => `BB ${num(p, 'period')} ${num(p, 'mult')}`,
    lookback: (p) => num(p, 'period'),
    onIndicator: true,
    compute: (bars, p) => {
      const { middle, upper, lower } = bollinger(priceSource(bars, src(p)), num(p, 'period'), num(p, 'mult'));
      const color = '#3182F6';
      return {
        series: [
          line('upper', 'Upper', upper, color),
          line('middle', 'Basis', middle, '#FF9F0A'),
          line('lower', 'Lower', lower, color),
        ],
        fill: { upper: 'upper', lower: 'lower', color },
        precision: null,
      };
    },
  },
  rsi: {
    type: 'rsi',
    name: { ko: 'RSI', en: 'RSI' },
    description: { ko: '상대강도지수 (과매수 70 / 과매도 30)', en: 'Relative Strength Index (70 / 30)' },
    overlay: false,
    params: [{ key: 'period', label: PARAM('기간', 'Period'), kind: 'number', min: 2, max: 200 }, SOURCE_PARAM],
    defaults: { period: 14, source: 'close' },
    title: (p) => `RSI ${num(p, 'period')}`,
    lookback: (p) => wilderLookback(num(p, 'period')),
    compute: (bars, p) => ({
      series: [line('rsi', 'RSI', rsi(priceSource(bars, src(p)), num(p, 'period')), '#7048E8')],
      levels: [30, 70],
      range: [0, 100],
      precision: 2,
    }),
  },
  macd: {
    type: 'macd',
    name: { ko: 'MACD', en: 'MACD' },
    description: { ko: '단기·장기 지수이동평균의 차이와 시그널', en: 'Fast/slow EMA spread with a signal line' },
    overlay: false,
    params: [
      { key: 'fast', label: PARAM('단기', 'Fast'), kind: 'number', min: 1, max: 200 },
      { key: 'slow', label: PARAM('장기', 'Slow'), kind: 'number', min: 1, max: 400 },
      { key: 'signal', label: PARAM('시그널', 'Signal'), kind: 'number', min: 1, max: 200 },
      SOURCE_PARAM,
    ],
    defaults: { fast: 12, slow: 26, signal: 9, source: 'close' },
    title: (p) => `MACD ${num(p, 'fast')} ${num(p, 'slow')} ${num(p, 'signal')}`,
    lookback: (p) => emaLookback(Math.max(num(p, 'fast'), num(p, 'slow'))) + emaLookback(num(p, 'signal')),
    compute: (bars, p) => {
      const m = macd(priceSource(bars, src(p)), num(p, 'fast'), num(p, 'slow'), num(p, 'signal'));
      return {
        series: [
          line('macd', 'MACD', m.macd, '#3182F6'),
          line('signal', 'Signal', m.signal, '#FF9F0A'),
          // Histograms are always painted beneath lines regardless of order here.
          { ...line('hist', 'Hist', m.histogram, ''), kind: 'histogram' },
        ],
        precision: null,
      };
    },
  },
};
