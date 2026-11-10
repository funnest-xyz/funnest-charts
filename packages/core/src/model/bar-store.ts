import type { Bar } from '../types';

export type UpsertResult = 'append' | 'update' | 'ignored';

/** Sorts by time and drops duplicate timestamps (the later entry wins). */
function normalize(bars: readonly Bar[]): Bar[] {
  let sorted = true;
  for (let i = 1; i < bars.length; i++) {
    if (bars[i]!.time <= bars[i - 1]!.time) {
      sorted = false;
      break;
    }
  }
  if (sorted) return bars.slice();

  const copy = bars.slice().sort((a, b) => a.time - b.time);
  const out: Bar[] = [];
  for (const bar of copy) {
    if (out.length > 0 && out[out.length - 1]!.time === bar.time) out[out.length - 1] = bar;
    else out.push(bar);
  }
  return out;
}

/** Time-ordered bar series. Index 0 is the oldest bar. */
export class BarStore {
  private items: Bar[] = [];

  get bars(): readonly Bar[] {
    return this.items;
  }

  get length(): number {
    return this.items.length;
  }

  at(index: number): Bar | undefined {
    return this.items[index];
  }

  first(): Bar | undefined {
    return this.items[0];
  }

  last(): Bar | undefined {
    return this.items[this.items.length - 1];
  }

  set(bars: readonly Bar[]): void {
    this.items = normalize(bars);
  }

  /** Adds older bars in front. Bars not strictly older than the current first bar are dropped. Returns the count added. */
  prepend(bars: readonly Bar[]): number {
    const first = this.first();
    const older = normalize(first ? bars.filter((b) => b.time < first.time) : bars);
    if (older.length > 0) this.items = older.concat(this.items);
    return older.length;
  }

  /**
   * Newer than the last bar → append. Same time as any existing bar → update in place
   * (late/out-of-order WebSocket messages can still correct a closed bar).
   * Older time that doesn't exist → ignored (use `merge` to fill gaps).
   */
  upsert(bar: Bar): UpsertResult {
    const last = this.last();
    if (!last || bar.time > last.time) {
      this.items.push(bar);
      return 'append';
    }
    const index = bar.time === last.time ? this.items.length - 1 : this.indexOfTime(bar.time);
    if (index < 0) return 'ignored';
    this.items[index] = bar;
    return 'update';
  }

  /**
   * Merges a batch that may overlap, extend, or fill gaps in the series
   * (e.g. bars re-fetched after a WebSocket reconnect). Incoming bars win on equal time.
   */
  merge(bars: readonly Bar[]): void {
    if (bars.length === 0) return;
    this.items = normalize(this.items.concat(bars));
  }

  /** Index of the bar containing `time` (largest bar.time <= time); -1 if before the first bar. */
  indexAtOrBefore(time: number): number {
    let lo = 0;
    let hi = this.items.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.items[mid]!.time <= time) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  }

  /**
   * Fractional index for any timestamp: interpolated between bars, extrapolated
   * beyond either end using `interval` (ms per bar). Lets drawings anchor to time.
   */
  indexFloatOfTime(time: number, interval: number): number {
    const n = this.items.length;
    if (n === 0) return Number.NaN;
    const first = this.items[0]!;
    const last = this.items[n - 1]!;
    if (time <= first.time) return (time - first.time) / interval;
    if (time >= last.time) return n - 1 + (time - last.time) / interval;
    const i = this.indexAtOrBefore(time);
    const t0 = this.items[i]!.time;
    const t1 = this.items[i + 1]!.time;
    return i + (time - t0) / (t1 - t0);
  }

  /** Inverse of `indexFloatOfTime`. */
  timeOfIndexFloat(index: number, interval: number): number {
    const n = this.items.length;
    if (n === 0) return Number.NaN;
    if (index <= 0) return this.items[0]!.time + index * interval;
    if (index >= n - 1) return this.items[n - 1]!.time + (index - (n - 1)) * interval;
    const i = Math.floor(index);
    const t0 = this.items[i]!.time;
    return t0 + (index - i) * (this.items[i + 1]!.time - t0);
  }

  /** Binary search for an exact timestamp; -1 when absent. */
  indexOfTime(time: number): number {
    let lo = 0;
    let hi = this.items.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const t = this.items[mid]!.time;
      if (t === time) return mid;
      if (t < time) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }
}
