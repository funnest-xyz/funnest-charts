import type {
  Chart,
  ChartContextMenu,
  ChartLayout,
  ChartType,
  CompareInfo,
  Datafeed,
  Drawing,
  DrawingType,
  IndicatorConfig,
  LegendItem,
  Locale,
  ReplayStatus,
  Resolution,
  SymbolInfo,
} from '@funnest/charts';
import type { LayoutId } from './layouts';
import type { WidgetStorage } from './storage';
import type { Strings } from './i18n';
import type { Store } from './store';

export interface UiState {
  locale: Locale;
  /** The app's replacements for built-in words (TradingChartOptions.strings). */
  strings?: Partial<Strings> | undefined;
  symbol: SymbolInfo | null;
  resolution: Resolution;
  loading: boolean;
  layout: ChartLayout;
  atRealtime: boolean;
  fullscreen: boolean;
  searchOpen: boolean;
  /** What a pick in the symbol search does: switch the symbol, or add it as a comparison. */
  searchTarget: 'symbol' | 'compare';
  chartType: ChartType;
  drawingTool: DrawingType | null;
  selection: Drawing | null;
  drawingCount: number;
  /** Narrow screens: the drawing bar is hidden until toggled from the toolbar. */
  drawbarOpen: boolean;
  magnet: boolean;
  indicators: IndicatorConfig[];
  /** Open dialog: indicator picker, or settings for one indicator id. */
  dialog: { kind: 'indicators' } | { kind: 'indicatorSettings'; id: string } | { kind: 'chartSettings' } | null;
  /** Intervals pinned as toolbar chips (★ in the interval menu). */
  favoriteIntervals: Resolution[];
  /** Desktop: the left drawing bar folded away (a small tab brings it back). */
  drawbarCollapsed: boolean;
  canUndo: boolean;
  canRedo: boolean;
  compares: CompareInfo[];
  /** The app's legend rows (chart.addLegendItem). */
  legendItems: readonly LegendItem[];
  replay: ReplayStatus;
}

/** A row in the chart's right-click menu, or a divider. */
export type ContextMenuItem = { label: string; shortcut?: string; disabled?: boolean; onSelect(): void } | 'separator';

/** Extra right-click items for a click on `chart` (e.g. "create an alert at this price"). */
export type ContextMenuItems = (target: ChartContextMenu & { chart: Chart }) => ContextMenuItem[];

/**
 * A row an app adds to the 도구 (tools) menu, above 차트 설정 — e.g. its own display settings.
 * `icon` is SVG markup (16×16, stroke="currentColor"), from the app itself.
 */
export interface ToolsMenuItem {
  label: string;
  icon?: string;
  disabled?: boolean;
  onSelect(chart: Chart): void;
}

/** The app's rows for the 도구 menu, asked each time it opens (for the pane's chart). */
export type ToolsMenuItems = (chart: Chart) => ToolsMenuItem[];

/**
 * The legend's OHLC row: 'always', or 'crosshair' — only while the crosshair is on the chart (a
 * phone's touch), shown over the chart then, so the candles don't move when it appears.
 */
export type LegendValues = 'always' | 'crosshair';

export interface IntervalGroup {
  id: 'minutes' | 'hours' | 'days';
  intervals: Resolution[];
}

/** A tab in the symbol search dialog. */
export interface SearchCategory {
  id: string;
  label: Record<Locale, string>;
  match(info: SymbolInfo): boolean;
}

/**
 * An exchange listed in the symbol search sidebar from the start (before any results), with its
 * logo. `name` is the `SymbolInfo.exchange` its symbols carry; `label` what to show.
 */
export interface SearchExchange {
  name: string;
  label?: Record<Locale, string>;
  logoUrl?: string;
}

/** Everything components need; created once per widget. */
export interface WidgetContext {
  /** The widget's root element (theme variables live here). */
  root: HTMLElement;
  chart: Chart;
  datafeed: Datafeed;
  store: Store<UiState>;
  storage: WidgetStorage;
  intervalGroups: readonly IntervalGroup[];
  searchCategories: readonly SearchCategory[];
  searchExchanges: readonly SearchExchange[];
  /** Rows per exchange before a "모두 보기" (0: all). */
  searchPreviewPerExchange: number;
  /** IANA zone used for the status-bar clock (KST for Korean users by default). */
  displayTimezone: string;
  showLogo: boolean;
  /** Ctrl/⌘+K opens symbol search (off when the page uses the shortcut for its own search). */
  searchHotkey: boolean;
  drawingToolbar: boolean;
  /** Show the Funnest logo badge on the chart. */
  attribution: boolean;
  contextMenuItems: ContextMenuItems | undefined;
  toolsMenuItems: ToolsMenuItems | undefined;
  legendValues: LegendValues;
  /** The app's own indicator browser for the 지표 button (instead of the built-in picker). */
  onIndicatorsClick: ((chart: Chart) => void) | undefined;
  slots: { toolbar: HTMLElement; toolbarEnd: HTMLElement; belowToolbar: HTMLElement; footer: HTMLElement };
  setDrawbarCollapsed(collapsed: boolean): void;
  selectSymbol(symbol: string): void;
  selectResolution(resolution: Resolution): void;
  toggleFavoriteInterval(resolution: Resolution): void;
  setSearchOpen(open: boolean, target?: 'symbol' | 'compare'): void;
  screenshot(): void;
  toggleFullscreen(): void;
  /** Present in the multi-chart widget: split layout and sync controls for the toolbar. */
  multi?: MultiControls | undefined;
}

/** What linked panes share in the multi-chart widget. */
export interface LayoutSync {
  /** Mirror the crosshair's time in every pane. */
  crosshair: boolean;
  /** Scroll/zoom every pane to the same time span. */
  time: boolean;
  /** Changing the symbol changes it in every pane. */
  symbol: boolean;
  /** Changing the interval changes it in every pane. */
  interval: boolean;
}

export interface MultiState {
  layout: LayoutId;
  sync: LayoutSync;
  /** Index of the pane the toolbar and drawing bar act on. */
  active: number;
  /** A pane temporarily filling the whole grid. */
  maximized: number | null;
  /** The container is too narrow to split: only the active pane shows, with pane tabs. */
  narrow: boolean;
}

export interface MultiControls {
  store: Store<MultiState>;
  setLayout(layout: LayoutId): void;
  setSync(patch: Partial<LayoutSync>): void;
  activate(index: number): void;
  toggleMaximize(index?: number): void;
}
