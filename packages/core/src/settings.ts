import type { Drawing } from './objects/drawings';
import type { IndicatorConfig } from './indicators/manager';
import type { PriceScaleMode } from './model/price-scale';
import type { ChartType } from './render/renderer';
import type { Resolution } from './types';

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
  /** Price axis: linear prices, log scale, or % change from the first visible bar. Comparing symbols forces '%'. */
  priceScale: PriceScaleMode;
  /** Time left until the current bar closes, under the last-price badge. */
  countdown: boolean;
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
}

const CHART_TYPES: readonly ChartType[] = ['candles', 'line', 'area'];

/** Validates untrusted JSON (e.g. from storage) into a ChartState; throws on an incompatible shape. */
export function parseChartState(input: unknown): ChartState {
  const s = input as Partial<ChartState> | null;
  if (!s || typeof s !== 'object' || s.version !== 1) throw new Error('funnest-charts: unsupported chart state (expected version 1)');
  return {
    version: 1,
    symbol: typeof s.symbol === 'string' ? s.symbol : null,
    resolution: typeof s.resolution === 'string' ? s.resolution : null,
    chartType: CHART_TYPES.includes(s.chartType as ChartType) ? (s.chartType as ChartType) : 'candles',
    settings: { ...DEFAULT_CHART_SETTINGS, ...(s.settings ?? {}) },
    indicators: Array.isArray(s.indicators) ? s.indicators : [],
    drawings: s.drawings && typeof s.drawings === 'object' ? s.drawings : {},
    paneWeights:
      s.paneWeights && typeof s.paneWeights === 'object'
        ? Object.fromEntries(Object.entries(s.paneWeights).filter(([, w]) => typeof w === 'number' && w > 0))
        : {},
    compares: Array.isArray(s.compares) ? s.compares.filter((x): x is string => typeof x === 'string') : [],
    view: {
      barSpacing: Number(s.view?.barSpacing) || 8,
      rightOffset: Number.isFinite(Number(s.view?.rightOffset)) ? Number(s.view?.rightOffset) : 5,
    },
  };
}
