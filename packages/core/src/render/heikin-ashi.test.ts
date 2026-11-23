import { describe, expect, it } from 'vitest';
import type { Bar } from '../types.js';
import { heikinAshi } from './heikin-ashi.js';

const bar = (time: number, open: number, high: number, low: number, close: number, volume = 1): Bar => ({ time, open, high, low, close, volume });

describe('heikinAshi', () => {
  it('follows the textbook formulas', () => {
    const bars = [bar(1, 10, 12, 9, 11), bar(2, 11, 15, 10, 14)];
    const ha = heikinAshi(bars);
    expect(ha[0]).toEqual({ time: 1, open: 10.5, close: 10.5, high: 12, low: 9, volume: 1 });
    // close (11+15+10+14)/4 = 12.5; open (10.5+10.5)/2 = 10.5
    expect(ha[1]).toEqual({ time: 2, open: 10.5, close: 12.5, high: 15, low: 10, volume: 1 });
  });

  it('high and low take in the HA open and close when they reach past the bar', () => {
    const ha = heikinAshi([bar(1, 100, 101, 99, 100), bar(2, 50, 52, 48, 51)]);
    // open (100+100)/2 = 100 is above the bar's high 52.
    expect(ha[1]).toMatchObject({ open: 100, high: 100, low: 48 });
  });

  it('a live tick redoes the last candle; a new bar adds one; the rest stays as it was', () => {
    const bars = [bar(1, 10, 12, 9, 11), bar(2, 11, 15, 10, 14)];
    const first = heikinAshi(bars);
    const kept = first[0];
    bars[1] = bar(2, 11, 20, 10, 19);
    const ticked = heikinAshi(bars);
    expect(ticked[0]).toBe(kept);
    expect(ticked[1]!.close).toBe((11 + 20 + 10 + 19) / 4);
    bars.push(bar(3, 19, 21, 18, 20));
    const grown = heikinAshi(bars);
    expect(grown).toHaveLength(3);
    expect(grown[2]!.open).toBe((ticked[1]!.open + ticked[1]!.close) / 2);
  });

  it('older bars loaded in front (or another symbol): worked out again from the first', () => {
    const bars = [bar(2, 11, 15, 10, 14), bar(3, 14, 16, 13, 15)];
    heikinAshi(bars);
    bars.unshift(bar(1, 10, 12, 9, 11));
    const again = heikinAshi(bars);
    expect(again.map((b) => b.time)).toEqual([1, 2, 3]);
    expect(again[1]!.open).toBe(10.5);
    expect(heikinAshi([])).toEqual([]);
  });
});
