import { resolutionToMs } from '../resolution.js';
import type { Bar, Resolution } from '../types.js';

/**
 * 타임프레임 (an indicator computed on another interval, TradingView's "Timeframe" input): the
 * higher interval's bars, and which of them each chart bar reads.
 */

/** Where the period that starts at `start` ends (the next one's start): calendar months for 'M'. */
export function periodEnd(start: number, resolution: Resolution): number {
  const m = /^(\d*)M$/i.exec(resolution.trim());
  if (m) {
    const d = new Date(start);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (m[1] ? Number(m[1]) : 1), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
  }
  return start + resolutionToMs(resolution);
}

/**
 * The higher interval's bars up to now: those fetched, the last of them (maybe still forming when
 * it was fetched) brought up to date with the chart's own bars, and any that began since built
 * from the chart's bars — so it follows the live price without its own subscription.
 */
export function composeHigher(fetched: readonly Bar[], chartBars: readonly Bar[], resolution: Resolution): Bar[] {
  if (!fetched.length) return [];
  const out: Bar[] = fetched.slice(0, -1);
  let cur: Bar = { ...fetched[fetched.length - 1]! };
  let end = periodEnd(cur.time, resolution);
  // The fetched one already counts what traded before the fetch: its volume isn't added to.
  let fromFetch = true;
  let added = 0;
  for (const b of chartBars) {
    if (b.time < cur.time) continue;
    if (b.time >= end) {
      if (fromFetch) cur.volume = Math.max(cur.volume ?? 0, added);
      out.push(cur);
      let start = end;
      while (periodEnd(start, resolution) <= b.time) start = periodEnd(start, resolution);
      cur = { time: start, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 };
      end = periodEnd(start, resolution);
      fromFetch = false;
      continue;
    }
    cur.high = Math.max(cur.high, b.high);
    cur.low = Math.min(cur.low, b.low);
    cur.close = b.close;
    if (fromFetch) added += b.volume ?? 0;
    else cur.volume = (cur.volume ?? 0) + (b.volume ?? 0);
  }
  if (fromFetch) cur.volume = Math.max(cur.volume ?? 0, added);
  out.push(cur);
  return out;
}

/**
 * For each chart bar, the higher bar it reads (-1: none yet). `waitClose` (타임프레임 마감 대기):
 * only higher bars that had closed by the end of that chart bar — the value never changes once
 * drawn; otherwise the one it's in (on history, its final value; live, still moving).
 */
export function mapToHigher(chartBars: readonly Bar[], higher: readonly Bar[], resolution: Resolution, waitClose: boolean): Int32Array {
  const n = chartBars.length;
  const index = new Int32Array(n).fill(-1);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = chartBars[i]!.time;
    while (j + 1 < higher.length && higher[j + 1]!.time <= t) j++;
    if (!higher.length || higher[j]!.time > t) continue;
    if (!waitClose) {
      index[i] = j;
      continue;
    }
    const end = Math.min(higher[j + 1]?.time ?? Infinity, periodEnd(higher[j]!.time, resolution));
    // The chart bar that ends the higher one shows it; the rest (and the live bar) the one before.
    const next = chartBars[i + 1];
    index[i] = next && next.time >= end ? j : j - 1;
  }
  return index;
}
