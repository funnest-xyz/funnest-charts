import type { Bar } from '../types';

/**
 * Magnet mode: the bar's open/high/low/close closest to pointer y (in pixels).
 * Used so drawing points land exactly on candle extremes.
 */
export function snapToOhlc(bar: Bar, y: number, priceToY: (price: number) => number): number {
  let best = bar.close;
  let bestDistance = Infinity;
  for (const price of [bar.open, bar.high, bar.low, bar.close]) {
    const d = Math.abs(priceToY(price) - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = price;
    }
  }
  return best;
}
