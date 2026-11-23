import type { Bar } from '../types.js';

/**
 * Heikin-Ashi candles from regular ones (same times, same volumes):
 *   close = (open + high + low + close) / 4
 *   open  = (previous HA open + previous HA close) / 2 — the first: (open + close) / 2
 *   high  = max(high, HA open, HA close),  low = min(low, HA open, HA close)
 * Each candle depends on the one before, so the series is worked out from the first bar. Kept
 * between frames: a live tick redoes the last candle, a new bar adds one, anything else (another
 * symbol, older bars loaded in front) starts over.
 */
let cache: { src: readonly Bar[]; first: number; out: Bar[] } | null = null;

const step = (bar: Bar, prev: Bar | undefined): Bar => {
  const close = (bar.open + bar.high + bar.low + bar.close) / 4;
  const open = prev ? (prev.open + prev.close) / 2 : (bar.open + bar.close) / 2;
  return {
    time: bar.time,
    open,
    high: Math.max(bar.high, open, close),
    low: Math.min(bar.low, open, close),
    close,
    ...(bar.volume !== undefined ? { volume: bar.volume } : {}),
  };
};

export function heikinAshi(bars: readonly Bar[]): Bar[] {
  const n = bars.length;
  const c = cache;
  if (c && c.src === bars && n > 0 && c.first === bars[0]!.time && c.out.length >= n - 1 && c.out.length <= n && (c.out.length < 2 || c.out[c.out.length - 2]!.time === bars[c.out.length - 2]!.time)) {
    // The same series: redo the last candle (it may have changed) and add any new one.
    const from = Math.max(0, c.out.length - 1);
    c.out.length = from;
    for (let i = from; i < n; i++) c.out.push(step(bars[i]!, c.out[i - 1]));
    return c.out;
  }
  const out: Bar[] = [];
  for (let i = 0; i < n; i++) out.push(step(bars[i]!, out[i - 1]));
  cache = { src: bars, first: n ? bars[0]!.time : 0, out };
  return out;
}
