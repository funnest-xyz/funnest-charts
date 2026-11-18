import { DAY_MS } from './resolution.js';

/**
 * A compared symbol's closes on the main series' bars: each main bar gets the compared
 * symbol's latest bar at or before it.
 *
 * Intraday that's by time. Daily and longer bars start at different instants per market —
 * Binance at 00:00 UTC, Korean stocks at midnight KST (15:00 UTC the day before), US stocks
 * and futures at midnight New York (05:00 UTC) — so comparing by time put a US stock's
 * previous day on a Binance day. They're matched by trading date instead: the UTC date half a
 * day after the bar starts, which is the bar's own date for any market between UTC−12 and
 * UTC+12 (weeks: their Monday; months: the 1st).
 */
export function alignCloses(mainTimes: readonly number[], other: readonly { time: number; close: number }[], byDate: boolean): Float64Array {
  const key = byDate ? (t: number) => Math.floor((t + DAY_MS / 2) / DAY_MS) : (t: number) => t;
  const values = new Float64Array(mainTimes.length).fill(Number.NaN);
  let j = -1;
  for (let i = 0; i < mainTimes.length; i++) {
    const k = key(mainTimes[i]!);
    while (j + 1 < other.length && key(other[j + 1]!.time) <= k) j++;
    if (j >= 0) values[i] = other[j]!.close;
  }
  return values;
}
