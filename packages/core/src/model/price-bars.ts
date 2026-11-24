import type { Bar } from '../types.js';
import { BarStore, type UpsertResult } from './bar-store.js';

/**
 * Charts drawn from price moves instead of time (TradingView's renko · kagi · line break · point &
 * figure). Each turns the time bars into its own bars:
 *
 * - renko: a brick every `box` the close moves; turning back takes two boxes.
 * - lineBreak (3선 전환): a new line when the close passes the last line; turning back takes a
 *   close past the extreme of the last three lines.
 * - kagi: a line that goes on while the close keeps its way and turns when it comes back by
 *   `box`; thick (양) once it rises past the last shoulder, thin (음) once it falls past the last
 *   waist.
 * - pnf (P&F): columns of X (rising) and O (falling) boxes; a new column after a three-box turn.
 *
 * Their bars keep the time of the bar that made them (a millisecond apart when one bar makes
 * several, so times stay unique), and carry that bar's volume on the first of them.
 */
export type PriceBarKind = 'renko' | 'kagi' | 'lineBreak' | 'pnf';

export const PRICE_BAR_KINDS: readonly PriceBarKind[] = ['renko', 'kagi', 'lineBreak', 'pnf'];

export interface PriceBars {
  bars: Bar[];
  /** Renko brick, kagi turn, P&F box (price units); 0 for line break. */
  box: number;
  /** Kagi: 1 where a line ends thick (양). */
  yang?: Uint8Array;
  /** Kagi: where a line turns thick or thin on its way (NaN: it doesn't). */
  cross?: Float64Array;
}

/** A tidy step near `v` (1, 2, 2.5, 5 × a power of ten). */
export function niceStep(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * p;
}

/** ATR(14) of the bars (Wilder), as a tidy step: TradingView's default box for these charts. */
export function atrBox(bars: readonly Bar[], period = 14): number {
  if (bars.length < 2) return niceStep((bars[0]?.close ?? 0) * 0.01);
  let atr = 0;
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]!;
    const prev = bars[i - 1]!.close;
    const tr = Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
    atr = i <= period ? atr + (tr - atr) / i : atr + (tr - atr) / period;
  }
  return niceStep(atr) || niceStep(bars[bars.length - 1]!.close * 0.01);
}

function times() {
  let last = Number.NEGATIVE_INFINITY;
  return (t: number) => (last = Math.max(t, last + 1));
}

const bar = (time: number, open: number, close: number, volume: number): Bar => ({ time, open, close, high: Math.max(open, close), low: Math.min(open, close), volume });

export function renko(src: readonly Bar[], box: number): PriceBars {
  const out: Bar[] = [];
  if (!src.length || !(box > 0)) return { bars: out, box };
  const at = times();
  // The current brick's top and bottom (none yet: both at the first close, on the box grid).
  let hi = Math.round(src[0]!.close / box) * box;
  let lo = hi;
  let volume = 0;
  for (const b of src) {
    volume += b.volume ?? 0;
    while (b.close >= hi + box) {
      out.push(bar(at(b.time), hi, hi + box, volume));
      volume = 0;
      lo = hi;
      hi += box;
    }
    while (b.close <= lo - box) {
      out.push(bar(at(b.time), lo, lo - box, volume));
      volume = 0;
      hi = lo;
      lo -= box;
    }
  }
  return { bars: out, box };
}

export function lineBreak(src: readonly Bar[], lines = 3): PriceBars {
  const out: Bar[] = [];
  if (!src.length) return { bars: out, box: 0 };
  const at = times();
  const first = src[0]!;
  let volume = 0;
  let start = 0;
  // The first line: from the first bar's open to the first close that differs from it.
  while (start < src.length && src[start]!.close === first.open) volume += src[start++]!.volume ?? 0;
  if (start >= src.length) return { bars: out, box: 0 };
  out.push(bar(at(src[start]!.time), first.open, src[start]!.close, volume + (src[start]!.volume ?? 0)));
  volume = 0;
  for (let i = start + 1; i < src.length; i++) {
    const b = src[i]!;
    volume += b.volume ?? 0;
    const last = out[out.length - 1]!;
    const up = last.close > last.open;
    const recent = out.slice(-lines);
    const high = Math.max(...recent.map((x) => x.high));
    const low = Math.min(...recent.map((x) => x.low));
    if (up ? b.close > last.close : b.close < last.close) {
      out.push(bar(at(b.time), last.close, b.close, volume));
      volume = 0;
    } else if (up ? b.close < low : b.close > high) {
      // Turning: from the last line's start, past the extreme of the last few.
      out.push(bar(at(b.time), last.open, b.close, volume));
      volume = 0;
    }
  }
  return { bars: out, box: 0 };
}

export function kagi(src: readonly Bar[], reversal: number): PriceBars {
  const out: Bar[] = [];
  const yang: number[] = [];
  const cross: number[] = [];
  if (!src.length || !(reversal > 0)) return { bars: out, box: reversal };
  const at = times();
  let start = src[0]!.close;
  let end = start;
  let dir = 0;
  let time = src[0]!.time;
  let volume = 0;
  // 양 (thick) / 음 (thin); the last shoulder (top of a rise) and waist (bottom of a fall).
  let thick = true;
  let shoulder = Number.NaN;
  let waist = Number.NaN;
  const push = () => {
    // A rise past the last shoulder turns it thick there; a fall past the last waist, thin.
    let turn = Number.NaN;
    if (dir > 0 && !thick && end > shoulder) [turn, thick] = [shoulder, true];
    else if (dir < 0 && thick && end < waist) [turn, thick] = [waist, false];
    out.push(bar(at(time), start, end, volume));
    yang.push(thick ? 1 : 0);
    cross.push(turn);
    volume = 0;
    if (dir > 0) shoulder = end;
    else waist = end;
  };
  for (const b of src) {
    volume += b.volume ?? 0;
    const c = b.close;
    if (dir === 0) {
      if (Math.abs(c - start) >= reversal) {
        dir = c > start ? 1 : -1;
        thick = dir > 0;
        end = c;
      }
      continue;
    }
    if (dir > 0 ? c > end : c < end) end = c;
    else if (dir > 0 ? end - c >= reversal : c - end >= reversal) {
      push();
      start = end;
      end = c;
      dir = -dir;
      time = b.time;
    }
  }
  // The line still going: shown as it stands (it may go on, or turn).
  if (dir !== 0) push();
  return { bars: out, box: reversal, yang: Uint8Array.from(yang), cross: Float64Array.from(cross) };
}

export function pnf(src: readonly Bar[], box: number, reversal = 3): PriceBars {
  const out: Bar[] = [];
  if (!src.length || !(box > 0)) return { bars: out, box };
  const at = times();
  const level = (p: number) => Math.floor(p / box + 1e-9);
  let dir = 0;
  let top = level(src[0]!.close);
  let bottom = top;
  let time = src[0]!.time;
  let volume = 0;
  // A column covers boxes bottom..top: X from bottom·box up to (top+1)·box, O the other way.
  const column = () => (dir > 0 ? bar(time, bottom * box, (top + 1) * box, volume) : bar(time, (top + 1) * box, bottom * box, volume));
  const closed: Bar[] = [];
  for (const b of src) {
    volume += b.volume ?? 0;
    const k = level(b.close);
    if (dir === 0) {
      if (k > top) [dir, top] = [1, k];
      else if (k < bottom) [dir, bottom] = [-1, k];
      continue;
    }
    if (dir > 0) {
      if (k > top) top = k;
      else if (k <= top - reversal) {
        closed.push(column());
        volume = 0;
        [dir, top, bottom, time] = [-1, top - 1, k, b.time];
      }
    } else if (k < bottom) bottom = k;
    else if (k >= bottom + reversal) {
      closed.push(column());
      volume = 0;
      [dir, bottom, top, time] = [1, bottom + 1, k, b.time];
    }
  }
  if (dir !== 0) closed.push(column());
  for (const c of closed) out.push({ ...c, time: at(c.time) });
  return { bars: out, box };
}

/** The bars of `kind` from time bars, with its box (`box` 0: ATR 14). */
export function priceBars(kind: PriceBarKind, src: readonly Bar[], box = 0): PriceBars {
  const size = box > 0 ? box : atrBox(src);
  if (kind === 'renko') return renko(src, size);
  if (kind === 'kagi') return kagi(src, size);
  if (kind === 'pnf') return pnf(src, size);
  return lineBreak(src);
}

/**
 * The chart's bars for a price-move chart: the time bars kept underneath (`raw`) as they come
 * (loaded, paged back, live), the shown ones made again from them after each change. The box is
 * set from the bars on a full load and kept after (a live bar mustn't redraw every brick).
 */
export class PriceBarStore extends BarStore {
  meta: Omit<PriceBars, 'bars'> = { box: 0 };

  constructor(
    readonly raw: BarStore,
    readonly kind: PriceBarKind,
    private box = 0,
  ) {
    super();
    this.rebuild();
  }

  private rebuild(): void {
    if (!(this.box > 0) && this.raw.length > 0) this.box = atrBox(this.raw.bars);
    const { bars, ...meta } = priceBars(this.kind, this.raw.bars, this.box);
    this.meta = meta;
    super.set(bars);
  }

  override set(bars: readonly Bar[]): void {
    this.raw.set(bars);
    this.box = 0;
    this.rebuild();
  }

  override prepend(bars: readonly Bar[]): number {
    const before = this.length;
    this.raw.prepend(bars);
    this.rebuild();
    return Math.max(0, this.length - before);
  }

  override merge(bars: readonly Bar[]): void {
    this.raw.merge(bars);
    this.rebuild();
  }

  override upsert(b: Bar): UpsertResult {
    const before = this.length;
    if (this.raw.upsert(b) === 'ignored') return 'ignored';
    this.rebuild();
    return this.length > before ? 'append' : 'update';
  }
}
