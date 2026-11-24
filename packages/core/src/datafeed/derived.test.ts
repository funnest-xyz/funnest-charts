import { describe, expect, it } from 'vitest';
import { fallbackResolution } from '../chart.js';
import type { Bar, BarsRequest, Datafeed, Resolution, SymbolInfo } from '../types.js';
import { derivedBase, groupBars, withDerivedResolutions } from './derived.js';

const H = 3_600_000;
const D = 86_400_000;
const NATIVE: Resolution[] = ['1', '5', '15', '60', '240', '1D', '1W', '1M'];
const info = { symbol: 'X', name: 'X', supportedResolutions: NATIVE } as SymbolInfo;
const bar = (time: number, o: number, h: number, l: number, c: number, v = 1): Bar => ({ time, open: o, high: h, low: l, close: c, volume: v });

describe('derived intervals', () => {
  it('picks the largest supported interval that divides the one asked for', () => {
    expect(derivedBase('120', NATIVE)).toBe('60');
    expect(derivedBase('3', NATIVE)).toBe('1');
    expect(derivedBase('45', NATIVE)).toBe('15');
    expect(derivedBase('480', NATIVE)).toBe('240');
    expect(derivedBase('2D', NATIVE)).toBe('1D');
    expect(derivedBase('2W', NATIVE)).toBe('1W');
    expect(derivedBase('2M', NATIVE)).toBe('1M');
    // Supported already, or the feed says nothing: none needed.
    expect(derivedBase('60', NATIVE)).toBeNull();
    expect(derivedBase('120', undefined)).toBeNull();
    // Nothing divides it.
    expect(derivedBase('7', ['5', '15'])).toBeNull();
    // The chart keeps such an interval instead of falling back.
    expect(fallbackResolution('120', NATIVE)).toBe('120');
    expect(fallbackResolution('7', ['5', '15'])).toBe('5');
  });

  it('2시간: hours grouped on even UTC hours — open first, close last, highs, lows and volumes', () => {
    const t0 = Date.UTC(2026, 10, 24, 0);
    const hours = [bar(t0, 10, 12, 9, 11), bar(t0 + H, 11, 15, 10, 14), bar(t0 + 2 * H, 14, 14, 8, 9), bar(t0 + 3 * H, 9, 10, 7, 8, 5)];
    expect(groupBars(hours, '120').bars).toEqual([bar(t0, 10, 15, 9, 14, 2), bar(t0 + 2 * H, 14, 14, 7, 8, 6)]);
  });

  it('2일 and 2주 from the base candles’ dates (days stamped at local midnight still count right)', () => {
    const kst = Date.UTC(2026, 10, 23) - 9 * H; // 11-23 00:00 KST
    const days = [0, 1, 2, 3].map((i) => bar(kst + i * D, i, i + 1, i - 1, i + 0.5));
    // Pairs of days counted from 1970-01-01: whether 11-23 starts a pair depends on its day number.
    const evenStart = Math.floor((kst + D / 2) / D) % 2 === 0;
    expect(groupBars(days, '2D').bars.map((b) => b.volume)).toEqual(evenStart ? [2, 2] : [1, 2, 1]);
    // 11-23 (Mon) to 11-26 (Thu): one week, so one 2-week candle.
    expect(groupBars(days, '2W').bars).toHaveLength(1);
  });

  it('serves history and live candles through the base interval', async () => {
    const t0 = Date.UTC(2026, 10, 24, 0);
    const asked: [Resolution, BarsRequest][] = [];
    let live: ((b: Bar) => void) | null = null;
    const feed: Datafeed = {
      resolveSymbol: async () => info,
      getBars: async (_i, resolution, req) => {
        asked.push([resolution, req]);
        return { bars: [0, 1, 2, 3].map((i) => bar(t0 + i * H, 1, 2, 0, 1)), noMoreData: true };
      },
      subscribeBars: (_i, _r, onBar) => {
        live = onBar;
        return () => {};
      },
      searchSymbols: async () => [],
    };
    const wrapped = withDerivedResolutions(feed);
    const r = await wrapped.getBars(info, '120', { from: 0, to: t0 + 4 * H, countBack: 2 });
    expect(asked[0]![0]).toBe('60');
    expect(asked[0]![1].countBack).toBe(6);
    expect(r.bars.map((b) => b.time)).toEqual([t0, t0 + 2 * H]);
    // A new hour in the last 2-hour candle updates it; the next one opens a new candle.
    const got: Bar[] = [];
    wrapped.subscribeBars(info, '120', (b) => got.push(b));
    live!(bar(t0 + 3 * H, 1, 9, 0, 5));
    live!(bar(t0 + 4 * H, 5, 6, 4, 6));
    expect(got.map((b) => [b.time, b.high, b.close])).toEqual([
      [t0 + 2 * H, 9, 5],
      [t0 + 4 * H, 6, 6],
    ]);
    // Search and the rest still reach the feed.
    expect(await wrapped.searchSymbols!('')).toEqual([]);
  });
});
