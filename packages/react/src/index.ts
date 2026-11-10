/**
 * @funnest/charts-react — React bindings for the funnest-charts trading widget.
 *
 * ```tsx
 * <FnChart datafeed={feed} symbol="005930" resolution="1D" style={{ height: 600 }}>
 *   <FnChartSlot name="toolbar"><MyMarketStats /></FnChartSlot>
 * </FnChart>
 * ```
 */
export { FnChart, FnChartSlot, useChartEvent, useFnChart } from './fn-chart';
export type { FnChartProps } from './fn-chart';
export type { TradingChart, TradingChartOptions, TradingChartSlots } from '@funnest/charts-ui';
