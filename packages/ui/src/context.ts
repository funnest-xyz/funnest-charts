import type {
  Chart,
  ChartLayout,
  ChartType,
  Datafeed,
  Drawing,
  DrawingType,
  IndicatorConfig,
  Locale,
  Resolution,
  SymbolInfo,
} from '@funnest/charts';
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
  slots: { toolbar: HTMLElement; belowToolbar: HTMLElement; footer: HTMLElement };
  setDrawbarCollapsed(collapsed: boolean): void;
  selectSymbol(symbol: string): void;
  selectResolution(resolution: Resolution): void;
  toggleFavoriteInterval(resolution: Resolution): void;
  setSearchOpen(open: boolean): void;
  screenshot(): void;
  toggleFullscreen(): void;
}
