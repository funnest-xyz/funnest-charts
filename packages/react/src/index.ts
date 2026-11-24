/**
 * @funnest/charts-react — React bindings for the funnest-charts trading widget.
 *
 * ```tsx
 * <FnChart datafeed={feed} symbol="005930" resolution="1D" style={{ height: 600 }}>
 *   <FnChartSlot name="toolbar"><MyMarketStats /></FnChartSlot>
 * </FnChart>
 * ```
 *
 * Plus SVG chart components (LineChart, AreaChart, BarChart, CandlestickChart, DonutChart, TreemapChart,
 * PercentageBarChart, CartesianChart
 * and its parts) built on the platform-neutral math in @funnest/charts-viz.
 */
export { FnChart, FnChartSlot, useChartEvent, useFnChart } from './fn-chart.js';
export type { FnChartProps } from './fn-chart.js';
export { FnMultiChart, useFnMultiChart } from './fn-multi-chart.js';
export type { FnMultiChartProps } from './fn-multi-chart.js';
export type {
  ContextMenuItem,
  ContextMenuItems,
  DrawingAction,
  DrawingActions,
  PriceAxisActions,
  SettingsToggle,
  SettingsToggles,
  LayoutId,
  LayoutSync,
  LegendValues,
  MultiChart,
  MultiChartEvents,
  MultiChartOptions,
  MultiChartState,
  PaneSpec,
  TradingChart,
  TradingChartOptions,
  TradingChartSlots,
  ToolsMenuItem,
  ToolsMenuItems,
} from '@funnest/charts-ui';
export * from './viz/index.js';
