import { DAY_MS, resolutionToMs } from './resolution';
import type { Bar, Resolution } from './types';

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** UTC offset (ms) of `timeZone` at instant `time`. Positive east of UTC (Asia/Seoul = +9h). */
export function timeZoneOffset(time: number, timeZone: string): number {
  if (timeZone === 'UTC') return 0;
  let dtf = offsetFormatters.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    offsetFormatters.set(timeZone, dtf);
  }
  const p: Record<string, number> = {};
  for (const { type, value } of dtf.formatToParts(time)) p[type] = Number(value);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour! % 24, p.minute!, p.second!);
  return Math.round((asUtc - Math.floor(time / 1000) * 1000) / 60_000) * 60_000;
}

/**
 * Start time of the bar that contains `time`.
 * Intraday buckets align to the local clock; D/W/M align to local midnight
 * (weeks start Monday). Pass the exchange's candle timezone — e.g. 'UTC' for
 * Upbit/Binance daily candles, 'Asia/Seoul' for KRX.
 */
export function bucketStart(time: number, resolution: Resolution, timeZone = 'UTC'): number {
  const offset = timeZoneOffset(time, timeZone);
  const local = time + offset;
  const unit = resolution.trim().slice(-1).toUpperCase();

  if (unit === 'M') {
    const n = Number(resolution.slice(0, -1)) || 1;
    const d = new Date(local);
    const months = d.getUTCFullYear() * 12 + d.getUTCMonth();
    const start = months - (months % n);
    return Date.UTC(Math.floor(start / 12), start % 12, 1) - offset;
  }
  if (unit === 'W') {
    const days = Math.floor(local / DAY_MS);
    const sinceMonday = (((days + 3) % 7) + 7) % 7; // 1970-01-01 was a Thursday
    return (days - sinceMonday) * DAY_MS - offset;
  }
  const size = resolutionToMs(resolution);
  return Math.floor(local / size) * size - offset;
}

export interface Tick {
  /** Trade time, UTC ms. */
  time: number;
  price: number;
  /** Traded quantity, added to the bar's volume. */
  volume?: number;
}

/**
 * Builds OHLCV bars from a trade/tick stream (e.g. Upbit `trade`, Binance `@trade`).
 *
 * ```ts
 * const agg = new TickAggregator('1', 'UTC');
 * agg.seed(lastHistoricalBar);              // continue the still-forming bar
 * socket.onmessage = (m) => {
 *   const bar = agg.push({ time: m.ts, price: m.price, volume: m.qty });
 *   if (bar) onBar(bar);
 * };
 * ```
 */
export class TickAggregator {
  private current: Bar | null = null;

  constructor(
    readonly resolution: Resolution,
    readonly timeZone = 'UTC',
  ) {}

  /** Start from the latest historical bar so the first tick updates it instead of opening a new one. */
  seed(bar: Bar | undefined): void {
    this.current = bar ? { ...bar, volume: bar.volume ?? 0 } : null;
  }

  /** Returns the updated bar, or null for a tick belonging to an already-closed bar. */
  push(tick: Tick): Bar | null {
    const start = bucketStart(tick.time, this.resolution, this.timeZone);
    const bar = this.current;
    const volume = tick.volume ?? 0;
    if (!bar || start > bar.time) {
      this.current = { time: start, open: tick.price, high: tick.price, low: tick.price, close: tick.price, volume };
    } else if (start === bar.time) {
      bar.high = Math.max(bar.high, tick.price);
      bar.low = Math.min(bar.low, tick.price);
      bar.close = tick.price;
      bar.volume = (bar.volume ?? 0) + volume;
    } else {
      return null;
    }
    return { ...this.current! };
  }
}
