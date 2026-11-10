import type { Drawing } from './objects/drawings';
import type { IndicatorConfig } from './indicators/manager';
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
  /** Up/down candle colors; null follows the theme. */
  upColor: string | null;
  downColor: string | null;
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  highLowMarkers: true,
  lastPriceLine: true,
  gridHorizontal: true,
  gridVertical: true,
  volume: true,
  navigationButtons: true,
  upColor: null,
  downColor: null,
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
    view: {
      barSpacing: Number(s.view?.barSpacing) || 8,
      rightOffset: Number.isFinite(Number(s.view?.rightOffset)) ? Number(s.view?.rightOffset) : 5,
    },
  };
}
