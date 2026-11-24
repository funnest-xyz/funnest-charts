import { describe, expect, it } from 'vitest';
import type { Bar } from '../types.js';
import { BarStore } from './bar-store.js';
import { atrBox, kagi, lineBreak, niceStep, pnf, PriceBarStore, renko } from './price-bars.js';

const closes = (cs: number[]): Bar[] => cs.map((c, i) => ({ time: i * 60_000, open: c, high: c, low: c, close: c, volume: 1 }));
const oc = (bars: readonly Bar[]) => bars.map((b) => [b.open, b.close]);

describe('price-move charts', () => {
  it('tidy box sizes', () => {
    expect([niceStep(0.13), niceStep(1.9), niceStep(23), niceStep(0)]).toEqual([0.1, 2, 25, 0]);
    expect(atrBox(closes([100, 101, 103, 102, 104]))).toBeGreaterThan(0);
  });

  it('renko: a brick per box; turning back takes two', () => {
    const out = renko(closes([100, 101.5, 102.2, 101.4, 100.9, 99.8, 98.9]), 1);
    // Up 100→101→102; 101.4 and 100.9 don't turn it (two boxes: ≤ 100); 99.8 does → 101→100; 98.9 → 100→99.
    expect(oc(out.bars)).toEqual([
      [100, 101],
      [101, 102],
      [101, 100],
      [100, 99],
    ]);
    // Unique, rising times even when one bar makes two bricks.
    const times = out.bars.map((b) => b.time);
    expect(new Set(times).size).toBe(times.length);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('line break: a new line past the last; turning back past the last three', () => {
    const src = closes([10, 11, 12, 13, 12.5, 11.5, 9.5, 9]);
    src[0]!.open = 9;
    // 9→10, 10→11, 11→12, 12→13; 12.5 and 11.5 stay inside the last three (10..13); 9.5 breaks → 12→9.5; 9 → 9.5→9.
    expect(oc(lineBreak(src).bars)).toEqual([
      [9, 10],
      [10, 11],
      [11, 12],
      [12, 13],
      [12, 9.5],
      [9.5, 9],
    ]);
  });

  it('kagi: turns on a reversal, thick past the last shoulder, thin past the last waist', () => {
    const out = kagi(closes([100, 103, 105, 102, 101, 104, 106, 103, 99]), 2);
    // Up 100→105; down 105→101; up 101→106 (past shoulder 105: stays thick); down 106→99 (past waist 101: thin at 101).
    expect(oc(out.bars)).toEqual([
      [100, 105],
      [105, 101],
      [101, 106],
      [106, 99],
    ]);
    expect(Array.from(out.yang!)).toEqual([1, 1, 1, 0]);
    expect(out.cross![3]).toBe(101);
  });

  it('point & figure: X up, O down, a new column after three boxes back', () => {
    const out = pnf(closes([100, 101, 103, 102, 101, 99.5, 102, 104]), 1, 3);
    // X 100..103; back to 99 (3 boxes) → O 102..99; up to 102 (3 boxes) → X 100..104.
    expect(out.bars.map((b) => [b.close > b.open ? 'X' : 'O', b.low, b.high])).toEqual([
      ['X', 100, 104],
      ['O', 99, 103],
      ['X', 100, 105],
    ]);
  });

  it('a store of them: loads, pages back and goes live on the time bars underneath', () => {
    const raw = new BarStore();
    const store = new PriceBarStore(raw, 'renko', 1);
    store.set(closes([100, 101.2, 102.4]));
    expect(oc(store.bars)).toEqual([
      [100, 101],
      [101, 102],
    ]);
    // A live tick that makes no brick: an update; one that does: an append.
    expect(store.upsert({ time: 3 * 60_000, open: 102.4, high: 102.6, low: 102.4, close: 102.6, volume: 1 })).toBe('update');
    expect(store.upsert({ time: 4 * 60_000, open: 102.6, high: 103.1, low: 102.6, close: 103.1, volume: 1 })).toBe('append');
    expect(store.length).toBe(3);
    expect(raw.length).toBe(5);
  });
});
