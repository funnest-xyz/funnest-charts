/**
 * @funnest/charts-ui — the full trading chart widget.
 * Preact is bundled internally; only a vanilla API is exposed, so consumers
 * need no framework (React/Vue/Svelte/plain HTML all work).
 */
export {
  createTradingChart,
  DEFAULT_FAVORITE_INTERVALS,
  DEFAULT_INTERVAL_GROUPS,
  DEFAULT_SEARCH_CATEGORIES,
} from './trading-chart.js';
export { createMultiChart } from './multi-chart.js';
export type { MultiChart, MultiChartEvents, MultiChartOptions, MultiChartState, PaneSpec } from './multi-chart.js';
export { LAYOUT_GROUPS, LAYOUTS, MAX_PANES, paneCount } from './layouts.js';
export type { LayoutId, SplitNode, SplitSizes } from './layouts.js';
export type { ContextMenuItem, ContextMenuItems, MenuIconName, DrawingAction, DrawingActions, IntervalGroup, PriceAxisActions, SettingsToggle, SettingsToggles, LayoutSync, LegendValues, SearchCategory, SearchExchange, ToolsMenuItem, ToolsMenuItems } from './context.js';
export type { ColorScheme, TradingChart, TradingChartOptions, TradingChartSlots } from './trading-chart.js';
export { resolutionLabel, STRINGS, stringsOf, type Strings } from './i18n.js';
