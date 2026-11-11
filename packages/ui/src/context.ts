import type {
  Chart,
  ChartLayout,
  ChartType,
  CompareInfo,
  Datafeed,
  Drawing,
  DrawingType,
  IndicatorConfig,
  Locale,
  ReplayStatus,
  Resolution,
  SymbolInfo,
} from '@funnest/charts';
import type { LayoutId } from './layouts';
import type { WidgetStorage } from './storage';
import type { Store } from './store';

export interface UiState {
  locale: Locale;
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
  replay: ReplayStatus;
}

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
  /** IANA zone used for the status-bar clock (KST for Korean users by default). */
  displayTimezone: string;
  showLogo: boolean;
  drawingToolbar: boolean;
  /** Show the Funnest logo badge on the chart. */
  attribution: boolean;
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
