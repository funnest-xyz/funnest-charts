/** @jsxImportSource preact */
import {
  browserLocale,
  type Chart,
  type ChartOptions,
  type ChartType,
  type Datafeed,
  type DirectionPreset,
  type Locale,
  type ChartState,
  type Resolution,
  type SymbolInfo,
  type ThemeTokens,
} from '@funnest/charts';
import { render } from 'preact';
import { DrawingToolbar } from './components/drawing-toolbar.js';
import { RangeBar } from './components/range-bar.js';
import { Toolbar } from './components/toolbar.js';
import type { ContextMenuItems, DrawingActions, IntervalGroup, LegendValues, PriceAxisActions, SearchCategory, SearchExchange, SettingsToggles, ToolsMenuItems } from './context.js';
import type { Strings } from './i18n.js';
import { createPane } from './pane.js';
import { bindWidgetKeys, createShell, type ColorScheme, type TradingChartSlots } from './shell.js';

export type { ColorScheme, TradingChartSlots } from './shell.js';

/** Interval menu: 분 | 시간 | 일. '12M' is shown as 1년. */
export const DEFAULT_INTERVAL_GROUPS: readonly IntervalGroup[] = [
  { id: 'minutes', intervals: ['1', '5', '15', '30'] },
  { id: 'hours', intervals: ['60', '240'] },
  { id: 'days', intervals: ['1D', '1W', '1M', '3M', '6M', '12M'] },
];

/** Toolbar chips until the user stars their own. */
export const DEFAULT_FAVORITE_INTERVALS: readonly Resolution[] = ['1', '5', '15', '60', '240', '1D'];

const stockLike = (i: SymbolInfo) => i.type === 'stock' || i.type === 'etf' || i.type === 'index';

/** Symbol search tabs, derived from `SymbolInfo.type` / `country`. */
export const DEFAULT_SEARCH_CATEGORIES: readonly SearchCategory[] = [
  { id: 'all', label: { ko: '전체', en: 'All' }, match: () => true },
  { id: 'kr-stock', label: { ko: '국내주식', en: 'KR stocks' }, match: (i) => stockLike(i) && i.country === 'KR' },
  { id: 'global-stock', label: { ko: '해외주식', en: 'Global stocks' }, match: (i) => stockLike(i) && i.country !== 'KR' },
  { id: 'crypto', label: { ko: '코인', en: 'Crypto' }, match: (i) => i.type === 'crypto' },
  { id: 'futures', label: { ko: '선물', en: 'Futures' }, match: (i) => i.type === 'futures' },
];

export interface TradingChartOptions extends Omit<ChartOptions, 'datafeed'> {
  datafeed: Datafeed;
  symbol: string;
  /** Default '1D'. */
  resolution?: Resolution;
  /** Interval menu groups (분 | 시간 | 일). */
  intervalGroups?: readonly IntervalGroup[];
  /** Initial toolbar chips; the user changes them with ★. Default: 1분 5분 15분 1시간 4시간 일. */
  favoriteIntervals?: readonly Resolution[];
  /** Called when the user stars/unstars an interval (e.g. to sync to their account). */
  onFavoriteIntervalsChange?: (intervals: Resolution[]) => void;
  /** Symbol search tabs. */
  searchCategories?: readonly SearchCategory[];
  /** Exchanges listed in the symbol search sidebar from the start, with logos (counts fill in as results come). */
  searchExchanges?: readonly SearchExchange[];
  /**
   * Symbol search: rows per exchange shown at first, each followed by "N개 모두 보기" when there
   * are more (picking the exchange lists them all). Default 0: everything at once.
   */
  searchPreviewPerExchange?: number;
  /**
   * localStorage key prefix for UI preferences (favorite intervals, recent searches).
   * Default 'funnest-charts'. Pass null to keep them in memory only.
   */
  storageKey?: string | null;
  /** Ctrl/⌘ + K opens symbol search. Default true. */
  searchHotkey?: boolean;

  /** Show symbol logos (SymbolInfo.logoUrl, or an initial avatar). Default true. */
  symbolLogo?: boolean;
  /** Show the left drawing tool bar. Default true. */
  drawingToolbar?: boolean;
  /** Initial chart type. Default 'candles'. */
  chartType?: ChartType;
  /**
   * Funnest logo badge in the bottom-left corner of the chart, linking to charts.funnest.xyz.
   * Default true. It is how a product meets the attribution notice in NOTICE (Apache-2.0
   * Section 4(d)); turned off, show "Charts by Funnest" with a link to https://charts.funnest.xyz/
   * on or next to every chart yourself.
   */
  attribution?: boolean;
  /**
   * Base palette. 'system' (default) follows the OS light/dark setting and switches live.
   * `theme` overrides are applied on top of whichever base is active.
   */
  colorScheme?: ColorScheme;
  /**
   * Extra rows for the chart's right-click menu (between undo/redo and the built-in actions),
   * e.g. "이 가격에 알림 만들기". Called on every right-click with the price and time under the pointer.
   */
  contextMenuItems?: ContextMenuItems;
  /** Rows of the price axis's + menu at the crosshair price (e.g. "이 가격에 알림 만들기"); without it there's no +. */
  priceAxisActions?: PriceAxisActions;
  /** Buttons on the bar of a selected drawing (e.g. 알림 on a trend line) — how phones reach drawing actions. */
  drawingActions?: DrawingActions;
  /** The app's own switches in 차트 설정 (e.g. extended hours for US stocks), asked when it opens. */
  settingsToggles?: SettingsToggles;
  /**
   * Extra rows for the 도구 (tools) menu, above 차트 설정 — e.g. the app's own display settings.
   * Called each time the menu opens, with the pane's chart.
   */
  toolsMenuItems?: ToolsMenuItems;
  /**
   * The legend's OHLC row: 'always' (default), or 'crosshair' — only while the crosshair is on the
   * chart, over the chart then (good for phones, where the legend takes up much of the screen).
   */
  legendValues?: LegendValues;
  /**
   * The toolbar's 지표 button opens this instead of the built-in indicator picker (an app's own
   * indicator browser). Called with the pane's chart; add indicators with chart.addIndicator().
   */
  onIndicatorsClick?: (chart: Chart) => void;
  /**
   * Language of the toolbar, menus and dates. Default: Korean when the browser is set to Korean,
   * English otherwise.
   */
  locale?: Locale;
  /**
   * Replace built-in words: a few (`{ indicators: 'Studies' }`) or all of them for a language of
   * your own (start from `STRINGS.en`). Applied over whichever locale is active.
   */
  strings?: Partial<Strings>;
  /**
   * Up/down colors: 'kr' red up · blue down, 'global' green up · red down. Default follows the
   * locale ('kr' for Korean, 'global' otherwise). `theme.up` / `theme.down` still win.
   */
  direction?: DirectionPreset;
}

export interface TradingChart {
  /** The underlying engine, for anything the widget doesn't wrap. */
  readonly chart: Chart;
  readonly slots: TradingChartSlots;
  setSymbol(symbol: string, resolution?: Resolution): Promise<void>;
  setResolution(resolution: Resolution): Promise<void>;
  setLocale(locale: Locale): void;
  /** Times in `timeZone` (IANA, e.g. 'UTC', 'America/New_York') from now on. */
  setDisplayTimezone(timeZone: string): void;
  /** Override theme tokens (kept across light/dark switches). */
  setTheme(theme: Partial<ThemeTokens>): void;
  setColorScheme(scheme: ColorScheme): void;
  /** Layout snapshot (symbol, interval, chart type, settings, indicators, drawings, view). */
  save(): ChartState;
  /** Restores a layout from `save()` / stored JSON. */
  load(state: ChartState | unknown): Promise<void>;
  destroy(): void;
}

/** Korean users read every time in KST unless told otherwise. */
export function defaultDisplayTimezone(locale: Locale, explicit?: string): string {
  return explicit ?? (locale === 'ko' ? 'Asia/Seoul' : Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * Full trading chart widget: toolbar (symbol search, intervals, screenshot, fullscreen),
 * legend, navigation controls and the canvas engine. Framework-agnostic: mount into any element.
 */
export function createTradingChart(container: HTMLElement, options: TradingChartOptions): TradingChart {
  const {
    datafeed,
    symbol,
    resolution = '1D',
    intervalGroups = DEFAULT_INTERVAL_GROUPS,
    favoriteIntervals,
    onFavoriteIntervalsChange,
    searchCategories = DEFAULT_SEARCH_CATEGORIES,
    searchExchanges = [],
    searchPreviewPerExchange = 0,
    storageKey = 'funnest-charts',
    searchHotkey = true,
    symbolLogo = true,
    drawingToolbar = true,
    chartType = 'candles',
    attribution = true,
    colorScheme = 'system',
    contextMenuItems,
    priceAxisActions,
    drawingActions,
    settingsToggles,
    toolsMenuItems,
    legendValues,
    onIndicatorsClick,
    theme,
    strings,
    direction,
    ...chartOptions
  } = options;
  const locale = (chartOptions.locale ??= browserLocale());
  const displayTimezone = defaultDisplayTimezone(locale, chartOptions.displayTimezone);
  const shell = createShell(container, {
    colorScheme,
    theme,
    direction: direction ?? (locale === 'ko' ? 'kr' : 'global'),
    storageKey,
    drawingToolbar,
    favoriteIntervals: favoriteIntervals ?? DEFAULT_FAVORITE_INTERVALS,
    onFavoriteIntervalsChange,
  });
  const pane = createPane(shell, {
    datafeed,
    chartOptions,
    displayTimezone,
    resolution,
    chartType,
    intervalGroups,
    searchCategories,
    searchExchanges,
    searchPreviewPerExchange,
    symbolLogo,
    searchHotkey,
    drawingToolbar,
    attribution,
    contextMenuItems,
    priceAxisActions,
    drawingActions,
    settingsToggles,
    toolsMenuItems,
    legendValues,
    onIndicatorsClick,
    strings,
  });
  shell.main.insertBefore(pane.stage, shell.rangeHost);
  shell.setPanes(() => [pane]);
  const unbindKeys = bindWidgetKeys(shell, () => pane, searchHotkey);

  render(<Toolbar ctx={pane.ctx} />, shell.toolbarHost);
  render(<RangeBar ctx={pane.ctx} />, shell.rangeHost);
  if (shell.drawbarHost) render(<DrawingToolbar ctx={pane.ctx} />, shell.drawbarHost);

  void pane.load(symbol, resolution);

  return {
    chart: pane.chart,
    slots: shell.slots,
    setSymbol: (sym, res) => pane.load(sym, res ?? pane.store.get().resolution),
    setResolution: (res) => {
      const current = pane.store.get().symbol;
      return current ? pane.load(current.symbol, res) : Promise.resolve();
    },
    setLocale: (locale) => {
      pane.chart.setLocale(locale);
      pane.store.set({ locale });
    },
    setDisplayTimezone: (timeZone) => pane.setDisplayTimezone(timeZone),
    save: () => pane.chart.save(),
    load: (state) => pane.chart.load(state),
    setTheme: shell.setTheme,
    setColorScheme: shell.setColorScheme,
    destroy: () => {
      unbindKeys();
      render(null, shell.toolbarHost);
      if (shell.drawbarHost) render(null, shell.drawbarHost);
      pane.destroy();
      shell.destroy();
    },
  };
}
