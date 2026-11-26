import type { Drawing } from './objects/drawings.js';
import type { IndicatorConfig } from './indicators/manager.js';
import type { PriceScaleMode } from './model/price-scale.js';
import type { ChartType } from './render/renderer.js';
import type { Resolution } from './types.js';

/** User-facing chart preferences (the "차트 설정" dialog). */
export interface ChartSettings {
  /** "최고/최저" labels at the visible price extremes. */
  highLowMarkers: boolean;
  /** Dotted line and axis badge at the last price. */
  lastPriceLine: boolean;
  gridHorizontal: boolean;
  gridVertical: boolean;
  /** Volume pane under the price pane. */
  volume: boolean;
  /** Zoom/scroll buttons at the bottom center of the chart (@funnest/charts-ui). */
  navigationButtons: boolean;
  /**
   * Price axis: linear prices, % change from the first visible bar, the first visible bar as 100
   * ('indexed'), or log scale. Comparing symbols forces '%'.
   */
  priceScale: PriceScaleMode;
  /** Time left until the current bar closes, under the last-price badge. */
  countdown: boolean;
  /** Stocks: the pre-market / after-hours price as a dotted line with its own axis badge (when the quote has one). */
  extendedPriceLine: boolean;
  /**
   * @deprecated Split into `zoomAnimation` and `scrollInertia`; setting it sets both.
   * 부드러운 스크롤·확대 (mouse and trackpad).
   */
  smoothScroll: boolean;
  /** 확대·축소 애니메이션: wheel zoom eases toward where it was sent instead of jumping. */
  zoomAnimation: boolean;
  /**
   * 이동 관성: a mouse drag let go glides on, and sideways wheel scrolling eases. Off: the view stops
   * where the drag ended (touch always glides).
   */
  scrollInertia: boolean;
  /** 가격 축 애니메이션: the auto-fitted price axis slides to its new range instead of jumping. */
  priceAxisAnimation: boolean;
  /** 가격 변동 애니메이션: the last candle's close (and the last-price line) slides to a new price. */
  priceAnimation: boolean;
  /** 로드 시 그리기 효과: on loading data, the series draws in from left to right. */
  drawOnLoad: boolean;
  /** 종목 워터마크: the symbol and interval, large and faint, behind the price pane. */
  symbolWatermark: boolean;
  /** 리플레이 워터마크: "리플레이" behind the price pane while a bar replay runs. */
  replayWatermark: boolean;
  /**
   * 차트 고정: dragging, the wheel, pinches, axis drags and the zoom / scroll buttons leave the view
   * as it is (it still follows new bars at the right edge). The crosshair and drawing still work.
   */
  lockView: boolean;
  /**
   * 가격 축 비율 고정 (TradingView's "lock price to bar ratio"): how much price a bar's width
   * stands for stays as it was when turned on, so zooming the time axis zooms the price axis with
   * it and trend lines keep their angle. The price axis doesn't fit itself to the candles meanwhile.
   */
  lockRatio: boolean;
  /** Up/down candle colors; null follows the theme. */
  upColor: string | null;
  downColor: string | null;
  /** Chart canvas colors (a theme from CHART_THEMES or your own); null follows the theme. `textColor` must be #rrggbb. */
  background: string | null;
  gridColor: string | null;
  textColor: string | null;
}

/** The settings a chart theme sets. */
export type ChartThemeColors = Pick<ChartSettings, 'upColor' | 'downColor' | 'background' | 'gridColor' | 'textColor'>;

export interface ChartThemePreset {
  id: string;
  name: { ko: string; en: string };
  colors: ChartThemeColors;
}

const FOLLOW: ChartThemeColors = { upColor: null, downColor: null, background: null, gridColor: null, textColor: null };

/**
 * Ready-made chart themes for the settings dialog. Applying one sets the five color settings;
 * 'default' clears them so the chart follows the page theme again.
 */
export const CHART_THEMES: readonly ChartThemePreset[] = [
  { id: 'default', name: { ko: '기본', en: 'Default' }, colors: FOLLOW },
  { id: 'global', name: { ko: '초록·빨강', en: 'Green · Red' }, colors: { ...FOLLOW, upColor: '#26A69A', downColor: '#EF5350' } },
  {
    id: 'midnight',
    name: { ko: '미드나잇', en: 'Midnight' },
    colors: { upColor: '#2EBD85', downColor: '#F6465D', background: '#0E1117', gridColor: '#1A1F29', textColor: '#C9D1D9' },
  },
  {
    id: 'navy',
    name: { ko: '딥 네이비', en: 'Deep navy' },
    colors: { upColor: '#FF5A5F', downColor: '#4C8DFF', background: '#0F1A2E', gridColor: '#1B2A44', textColor: '#C8D3E6' },
  },
  {
    // True black (OLED): the darkest, with a barely-there grid.
    id: 'deep-dark',
    name: { ko: '딥 다크', en: 'Deep dark' },
    colors: { upColor: '#F04452', downColor: '#3182F6', background: '#000000', gridColor: '#121212', textColor: '#B8BCC4' },
  },
  {
    // The same true black with the global colors: green up, red down.
    id: 'deep-dark-global',
    name: { ko: '딥 다크 그린', en: 'Deep dark green' },
    colors: { upColor: '#26A69A', downColor: '#EF5350', background: '#000000', gridColor: '#121212', textColor: '#B8BCC4' },
  },
  {
    id: 'mono',
    name: { ko: '모노', en: 'Mono' },
    colors: { upColor: '#E4E4E7', downColor: '#6B6B75', background: '#121214', gridColor: '#1F1F23', textColor: '#D4D4D8' },
  },
  {
    id: 'paper',
    name: { ko: '페이퍼', en: 'Paper' },
    colors: { upColor: '#F04452', downColor: '#3182F6', background: '#FFFFFF', gridColor: '#F0F2F5', textColor: '#333D4B' },
  },
  {
    id: 'sepia',
    name: { ko: '세피아', en: 'Sepia' },
    colors: { upColor: '#C2410C', downColor: '#2F6690', background: '#F6F0E4', gridColor: '#E9DFCB', textColor: '#4A3F33' },
  },
];

/** The preset whose colors `settings` match, if any. */
export function matchChartTheme(settings: ChartSettings): ChartThemePreset | undefined {
  const keys = Object.keys(FOLLOW) as (keyof ChartThemeColors)[];
  const same = (a: string | null, b: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  return CHART_THEMES.find((t) => keys.every((k) => same(t.colors[k], settings[k])));
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  highLowMarkers: true,
  lastPriceLine: true,
  gridHorizontal: true,
  gridVertical: true,
  volume: true,
  navigationButtons: true,
  priceScale: 'normal',
  countdown: true,
  extendedPriceLine: true,
  smoothScroll: false,
  zoomAnimation: true,
  scrollInertia: true,
  priceAxisAnimation: true,
  priceAnimation: true,
  drawOnLoad: false,
  symbolWatermark: false,
  replayWatermark: true,
  lockView: false,
  lockRatio: false,
  upColor: null,
  downColor: null,
  background: null,
  gridColor: null,
  textColor: null,
};

/**
 * Everything needed to restore a chart layout: symbol, interval, chart type, settings,
 * indicators, drawings (per symbol) and the visible window. Plain JSON — store it anywhere
 * (localStorage, your server) and pass it back to `load()`.
 */
export interface ChartState {
  version: 1;
  symbol: string | null;
  resolution: Resolution | null;
  chartType: ChartType;
  settings: ChartSettings;
  indicators: IndicatorConfig[];
  /** Drawings keyed by symbol ('' when the chart has no symbol, e.g. manual data). */
  drawings: Record<string, Drawing[]>;
  view: { barSpacing: number; rightOffset: number };
  /** Symbols overlaid for comparison (see `Chart.addCompare`). */
  compares?: string[];
  /** Pane heights the user dragged, as weights by pane id ('main', 'volume', indicator ids). */
  paneWeights?: Record<string, number>;
  /** How many indicator panes sit above the volume pane (0: right under the price pane). */
  volumeSlot?: number;
  /**
   * Which defaults the saved settings were made under (CHART_DEFAULTS_REV). Saved before a default
   * changed, a setting that default belongs to is taken back to it (see parseChartState).
   */
  defaultsRev?: number;
}

/**
 * Bumped when a default changes in a way saved layouts should follow:
 * 1 — 종목 워터마크 off by default (0.11.0–0.11.4 saved it on with everything else).
 */
export const CHART_DEFAULTS_REV = 1;

const CHART_TYPES: readonly ChartType[] = ['candles', 'hollow', 'heikin', 'bars', 'line', 'step', 'baseline', 'area', 'volumeCandles', 'renko', 'kagi', 'lineBreak', 'pnf'];

/** Settings saved under older defaults, with the ones that changed since taken to the new default. */
function followDefaults(settings: ChartSettings, rev: number): ChartSettings {
  // rev 1: every layout saved by 0.11.0–0.11.4 has the watermark on (the default then).
  if (rev < 1) settings.symbolWatermark = DEFAULT_CHART_SETTINGS.symbolWatermark;
  return settings;
}

/** Validates untrusted JSON (e.g. from storage) into a ChartState; throws on an incompatible shape. */
export function parseChartState(input: unknown): ChartState {
  const s = input as Partial<ChartState> | null;
  if (!s || typeof s !== 'object' || s.version !== 1) throw new Error('funnest-charts: unsupported chart state (expected version 1)');
  return {
    version: 1,
    symbol: typeof s.symbol === 'string' ? s.symbol : null,
    resolution: typeof s.resolution === 'string' ? s.resolution : null,
    chartType: CHART_TYPES.includes(s.chartType as ChartType) ? (s.chartType as ChartType) : 'candles',
    settings: followDefaults({ ...DEFAULT_CHART_SETTINGS, ...(s.settings ?? {}) }, Number(s.defaultsRev) || 0),
    defaultsRev: CHART_DEFAULTS_REV,
    indicators: Array.isArray(s.indicators) ? s.indicators : [],
    drawings: s.drawings && typeof s.drawings === 'object' ? s.drawings : {},
    paneWeights:
      s.paneWeights && typeof s.paneWeights === 'object'
        ? Object.fromEntries(Object.entries(s.paneWeights).filter(([, w]) => typeof w === 'number' && w > 0))
        : {},
    compares: Array.isArray(s.compares) ? s.compares.filter((x): x is string => typeof x === 'string') : [],
    volumeSlot: Number.isInteger(s.volumeSlot) && (s.volumeSlot as number) >= 0 ? (s.volumeSlot as number) : 0,
    view: {
      barSpacing: Number(s.view?.barSpacing) || 8,
      rightOffset: Number.isFinite(Number(s.view?.rightOffset)) ? Number(s.view?.rightOffset) : 5,
    },
  };
}
