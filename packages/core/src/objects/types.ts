import type { Painter } from '../render/painter';
import type { Palette } from '../render/renderer';

/** Coordinate helpers for objects living in the main price pane. */
export interface PaneCoords {
  plotWidth: number;
  height: number;
  timeToX(time: number): number;
  /** Fractional bar index of `time` (extrapolated past either end), e.g. to count bars between points. */
  timeToIndex(time: number): number;
  /** Point under (x, y): time snapped to the nearest bar (extrapolated into the future), price to the tick size. */
  pointAt(x: number, y: number): { time: number; price: number };
  priceToY(price: number): number;
  yToPrice(y: number): number;
  snapPrice(price: number): number;
  formatPrice(price: number): string;
}

export interface ObjectRenderContext {
  painter: Painter;
  coords: PaneCoords;
  palette: Palette;
}

/**
 * Something an app paints on the price pane every frame (a liquidation map, volume profile…),
 * clipped to the pane, above the candles and indicators, under trading lines and drawings.
 * Added with chart.addOverlay(); it reads its own data and the pane's coordinates.
 */
export interface ChartOverlay {
  render(rc: ObjectRenderContext): void;
}

export type ObjectHit =
  | { kind: 'drawing'; id: string; part: 'body' | number }
  | { kind: 'order'; id: string; part: 'line' | 'cancel' }
  | { kind: 'execution'; key: string };

/** A badge to draw on the price axis (collected so they render above axis labels). */
export interface AxisBadge {
  y: number;
  text: string;
  bg: string;
  fg: string;
}

let counter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;
