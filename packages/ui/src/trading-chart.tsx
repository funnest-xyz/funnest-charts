/** @jsxImportSource preact */
import {
  createChart,
  darkTheme,
  lightTheme,
  type Chart,
  type ChartOptions,
  type ChartType,
  type Datafeed,
  type Locale,
  type ChartState,
  type Resolution,
  type SymbolInfo,
  type ThemeTokens,
} from '@funnest/charts';
import { render } from 'preact';
import { DrawingToolbar } from './components/drawing-toolbar';
import { Overlay } from './components/overlay';
import { Toolbar } from './components/toolbar';
import type { IntervalGroup, SearchCategory, UiState, WidgetContext } from './context';
import { createStorage } from './storage';
import { Store } from './store';
import { injectStyles } from './styles';

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
   * Default true. Free to turn off (Apache-2.0); keeping it on is how you say thanks.
   */
  attribution?: boolean;
  /**
   * Base palette. 'system' (default) follows the OS light/dark setting and switches live.
   * `theme` overrides are applied on top of whichever base is active.
   */
  colorScheme?: ColorScheme;
}

export type ColorScheme = 'light' | 'dark' | 'system';

/**
 * Empty elements inside the widget layout where the host app mounts its own UI (any framework):
 * market stats, account info, status bars… They inherit the widget's `--fnc-*` theme variables
 * and collapse when empty.
 */
export interface TradingChartSlots {
  /** In the toolbar row, after the interval buttons. */
  readonly toolbar: HTMLElement;
  /** Right end of the toolbar, next to the settings (gear) button — for extra icon buttons. */
  readonly toolbarEnd: HTMLElement;
  /** A full-width row under the toolbar. */
  readonly belowToolbar: HTMLElement;
  /** A full-width row under the chart. */
  readonly footer: HTMLElement;
}

export interface TradingChart {
  /** The underlying engine, for anything the widget doesn't wrap. */
  readonly chart: Chart;
  readonly slots: TradingChartSlots;
  setSymbol(symbol: string, resolution?: Resolution): Promise<void>;
  setResolution(resolution: Resolution): Promise<void>;
  setLocale(locale: Locale): void;
  /** Override theme tokens (kept across light/dark switches). */
  setTheme(theme: Partial<ThemeTokens>): void;
  setColorScheme(scheme: ColorScheme): void;
  /** Layout snapshot (symbol, interval, chart type, settings, indicators, drawings, view). */
  save(): ChartState;
  /** Restores a layout from `save()` / stored JSON. */
  load(state: ChartState | unknown): Promise<void>;
  destroy(): void;
}

const THEME_VARS: Partial<Record<keyof ThemeTokens, string>> = {
  background: '--fnc-bg',
  surface: '--fnc-surface',
  text: '--fnc-text',
  textSecondary: '--fnc-text-2',
  border: '--fnc-border',
  up: '--fnc-up',
  down: '--fnc-down',
  accent: '--fnc-accent',
  fontFamily: '--fnc-font',
};

function applyThemeVars(el: HTMLElement, theme: ThemeTokens): void {
  for (const [key, cssVar] of Object.entries(THEME_VARS) as [keyof ThemeTokens, string][]) {
    el.style.setProperty(cssVar, String(theme[key]));
  }
  el.style.setProperty('--fnc-radius', `${theme.radius}px`);
}

function div(className: string, parent?: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  parent?.appendChild(el);
  return el;
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
    storageKey = 'funnest-charts',
    searchHotkey = true,
    symbolLogo = true,
    drawingToolbar = true,
    chartType = 'candles',
    attribution = true,
    colorScheme = 'system',
    ...chartOptions
  } = options;
  const locale = chartOptions.locale ?? 'ko';
  // Korean users read every time in KST unless told otherwise.
  const displayTimezone =
    chartOptions.displayTimezone ?? (locale === 'ko' ? 'Asia/Seoul' : Intl.DateTimeFormat().resolvedOptions().timeZone);
  const storage = createStorage(storageKey);
  injectStyles(container.ownerDocument);

  const win = container.ownerDocument.defaultView;
  const darkQuery = win?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  let scheme: ColorScheme = colorScheme;
  let themePatch: Partial<ThemeTokens> = { ...chartOptions.theme };
  const isDark = () => (scheme === 'system' ? !!darkQuery?.matches : scheme === 'dark');
  const resolveTheme = (): ThemeTokens => ({ ...(isDark() ? darkTheme : lightTheme), ...themePatch });
  let theme = resolveTheme();
  const root = div('fnc-root', container);
  const applyScheme = () => {
    root.dataset.colorScheme = isDark() ? 'dark' : 'light';
    root.style.colorScheme = isDark() ? 'dark' : 'light';
    applyThemeVars(root, theme);
  };
  applyScheme();
  const toolbarHost = div('fnc-toolbar-host', root);
  const slots: TradingChartSlots = {
    toolbar: div('fnc-slot fnc-slot-toolbar'),
    toolbarEnd: div('fnc-slot fnc-slot-toolbar-end'),
    belowToolbar: div('fnc-slot fnc-slot-below-toolbar', root),
    footer: div('fnc-slot fnc-slot-footer'),
  };
  const body = div('fnc-body', root);
  const drawbarHost = drawingToolbar ? div('fnc-drawbar-host', body) : null;
  const stage = div('fnc-stage', body);
  const chartHost = div('fnc-chart-host', stage);
  const overlayHost = div('fnc-overlay', stage);
  root.appendChild(slots.footer);

  const chart = createChart(chartHost, { ...chartOptions, theme, datafeed, displayTimezone });
  const refreshScheme = () => {
    theme = resolveTheme();
    applyScheme();
    chart.setTheme(theme);
  };
  const onSchemeChange = () => scheme === 'system' && refreshScheme();
  darkQuery?.addEventListener?.('change', onSchemeChange);
  chart.setChartType(chartType);
  const store = new Store<UiState>({
    locale,
    symbol: null,
    resolution,
    loading: false,
    layout: chart.layout,
    atRealtime: true,
    fullscreen: false,
    searchOpen: false,
    chartType,
    drawingTool: null,
    selection: null,
    drawingCount: 0,
    drawbarOpen: false,
    magnet: chart.magnetEnabled,
    indicators: chart.getIndicators(),
    dialog: null,
    favoriteIntervals: storage.get<Resolution[]>('favorite-intervals', [...(favoriteIntervals ?? DEFAULT_FAVORITE_INTERVALS)]),
    drawbarCollapsed: storage.get('drawbar-collapsed', false),
  });

  const syncRealtime = () => store.set({ atRealtime: chart.isAtRealtime() });
  const offs = [
    chart.on('symbolChange', (info) => store.set({ symbol: info, resolution: chart.currentResolution ?? resolution })),
    chart.on('loadingChange', (loading) => store.set({ loading })),
    chart.on('layoutChange', (layout) => store.set({ layout })),
    chart.on('visibleRangeChange', syncRealtime),
    chart.on('dataChange', syncRealtime),
    chart.on('drawingToolChange', (drawingTool) => store.set({ drawingTool })),
    chart.on('selectionChange', (selection) => store.set({ selection })),
    chart.on('drawingsChange', (drawings) => store.set({ drawingCount: drawings.length })),
    chart.on('indicatorsChange', (indicators) => store.set({ indicators })),
    chart.on('magnetChange', (magnet) => store.set({ magnet })),
    chart.on('chartTypeChange', (chartType) => store.set({ chartType })),
  ];

  const load = (sym: string, res: Resolution) => {
    store.set({ resolution: res });
    return chart.setSymbol(sym, res).catch((error: unknown) => {
      console.error('funnest-charts: failed to load', sym, res, error);
      store.set({ loading: false });
    });
  };

  // ── Fullscreen (native API with a CSS fallback for iOS Safari) ──
  const isNativeFullscreen = () => document.fullscreenElement === root;
  const onFullscreenChange = () =>
    store.set({ fullscreen: isNativeFullscreen() || root.classList.contains('fnc-pseudo-fullscreen') });
  const onKeyDown = (e: KeyboardEvent) => {
    const s = store.get();
    // Ctrl/⌘ + K opens symbol search from anywhere on the page.
    if (searchHotkey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && datafeed.searchSymbols && !s.dialog) {
      e.preventDefault();
      store.set({ searchOpen: true });
      return;
    }
    // Escape closes the top-most layer even when focus has left the dialog (clicking empty
    // space inside a dialog moves focus to <body>, so the dialog's own handler never sees it).
    if (e.key === 'Escape' && !e.defaultPrevented && (s.searchOpen || s.dialog)) {
      e.preventDefault();
      store.set(s.searchOpen ? { searchOpen: false } : { dialog: null });
      return;
    }
    if (e.key === 'Escape' && root.classList.contains('fnc-pseudo-fullscreen') && !s.searchOpen && !s.dialog) {
      root.classList.remove('fnc-pseudo-fullscreen');
      onFullscreenChange();
    }
  };
  // Korean/Japanese IME: while composing, the first Escape only ends the composition and
  // keydown reports "Process" (keyCode 229). The key-up still says "Escape", so close then.
  const onKeyUp = (e: KeyboardEvent) => {
    const s = store.get();
    if (e.key === 'Escape' && (s.searchOpen || s.dialog)) store.set(s.searchOpen ? { searchOpen: false } : { dialog: null });
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  const ctx: WidgetContext = {
    root,
    chart,
    datafeed,
    store,
    storage,
    intervalGroups,
    searchCategories,
    displayTimezone,
    showLogo: symbolLogo,
    drawingToolbar,
    attribution,
    slots,
    setDrawbarCollapsed: (collapsed) => {
      store.set({ drawbarCollapsed: collapsed });
      storage.set('drawbar-collapsed', collapsed);
    },
    selectSymbol: (sym) => void load(sym, store.get().resolution),
    selectResolution: (res) => {
      const current = store.get().symbol;
      if (current) void load(current.symbol, res);
    },
    toggleFavoriteInterval: (res) => {
      const current = store.get().favoriteIntervals;
      const next = current.includes(res) ? current.filter((r) => r !== res) : [...current, res];
      store.set({ favoriteIntervals: next });
      storage.set('favorite-intervals', next);
      onFavoriteIntervalsChange?.(next);
    },
    setSearchOpen: (open) => store.set({ searchOpen: open }),
    screenshot: () => {
      const s = store.get();
      chart.takeScreenshot().toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${s.symbol?.symbol ?? 'chart'}_${s.resolution}_${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
    },
    toggleFullscreen: () => {
      if (isNativeFullscreen()) {
        void document.exitFullscreen();
      } else if (root.classList.contains('fnc-pseudo-fullscreen')) {
        root.classList.remove('fnc-pseudo-fullscreen');
        onFullscreenChange();
      } else if (root.requestFullscreen && document.fullscreenEnabled) {
        root.requestFullscreen().catch(() => {
          root.classList.add('fnc-pseudo-fullscreen');
          onFullscreenChange();
        });
      } else {
        root.classList.add('fnc-pseudo-fullscreen');
        onFullscreenChange();
      }
    },
  };

  render(<Toolbar ctx={ctx} />, toolbarHost);
  render(<Overlay ctx={ctx} />, overlayHost);
  if (drawbarHost) render(<DrawingToolbar ctx={ctx} />, drawbarHost);

  void load(symbol, resolution);

  return {
    chart,
    slots,
    setSymbol: (sym, res) => load(sym, res ?? store.get().resolution),
    setResolution: (res) => {
      const current = store.get().symbol;
      return current ? load(current.symbol, res) : Promise.resolve();
    },
    setLocale: (locale) => {
      chart.setLocale(locale);
      store.set({ locale });
    },
    save: () => chart.save(),
    load: (state) => chart.load(state),
    setTheme: (patch) => {
      themePatch = { ...themePatch, ...patch };
      refreshScheme();
    },
    setColorScheme: (next) => {
      scheme = next;
      refreshScheme();
    },
    destroy: () => {
      offs.forEach((off) => off());
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      darkQuery?.removeEventListener?.('change', onSchemeChange);
      if (isNativeFullscreen()) void document.exitFullscreen();
      render(null, toolbarHost);
      render(null, overlayHost);
      if (drawbarHost) render(null, drawbarHost);
      chart.destroy();
      root.remove();
    },
  };
}
