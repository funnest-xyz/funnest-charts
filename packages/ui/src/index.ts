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
} from './trading-chart';
export { createMultiChart } from './multi-chart';
export type { MultiChart, MultiChartEvents, MultiChartOptions, MultiChartState, PaneSpec } from './multi-chart';
export { LAYOUT_GROUPS, LAYOUTS, MAX_PANES, paneCount } from './layouts';
export type { LayoutId, SplitNode, SplitSizes } from './layouts';
export type { ContextMenuItem, ContextMenuItems, IntervalGroup, LayoutSync, SearchCategory, SearchExchange } from './context';
export type { ColorScheme, TradingChart, TradingChartOptions, TradingChartSlots } from './trading-chart';
export { resolutionLabel } from './i18n';
