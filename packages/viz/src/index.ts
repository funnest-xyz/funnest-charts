/**
 * @funnest/charts-viz — platform-neutral chart math.
 *
 * Pure TypeScript with no DOM access, so the same scales, ticks and SVG path strings
 * drive the web components (@funnest/charts-react) and React Native (react-native-svg).
 */
export { linearScale, logScale, bandScale, clamp, type LinearScale, type LogScale, type ValueScale, type BandScale } from './scale.js';
export { niceStep, niceDomain, ticks, logTicks, sampleIndices } from './ticks.js';
export { linePath, areaPath, barPath, segments, type XY, type Curve } from './path.js';
export {
  extent,
  maxLength,
  stack,
  stackedExtent,
  percentages,
  nearestIndex,
  seriesChange,
  type SeriesData,
  type StackedSeries,
  type PercentageSegment,
} from './data.js';
export { DEFAULT_PALETTE, seriesColor } from './palette.js';
export { arcs, arcPath, arcCentroid, treemap, type ArcSegment, type TreemapRect } from './shapes.js';
