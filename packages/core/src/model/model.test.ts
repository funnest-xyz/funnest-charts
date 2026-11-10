import { describe, expect, it } from 'vitest';
import type { Bar } from '../types';
import { BarStore } from './bar-store';
import { niceTicks, PriceScale } from './price-scale';
import { boundaryWeight, computeTimeTicks, TickWeight, TimeFormatter } from './time-format';
import { TimeScale } from './time-scale';

const bar = (time: number, close = 100): Bar => ({ time, open: close, high: close, low: close, close });

describe('BarStore', () => {
  it('sorts and dedupes on set (later duplicate wins)', () => {
    const s = new BarStore();
    s.set([bar(3), bar(1), bar(2, 5), bar(2, 7)]);
    expect(s.bars.map((b) => b.time)).toEqual([1, 2, 3]);
    expect(s.at(1)!.close).toBe(7);
  });

  it('upserts realtime bars', () => {
    const s = new BarStore();
    s.set([bar(1), bar(2)]);
    expect(s.upsert(bar(2, 9))).toBe('update');
    expect(s.upsert(bar(3))).toBe('append');
    expect(s.upsert(bar(1))).toBe('update'); // late message corrects a closed bar
    expect(s.upsert(bar(0))).toBe('ignored');
    expect(s.length).toBe(3);
    expect(s.at(1)!.close).toBe(9);
  });

  it('prepends only strictly older bars', () => {
    const s = new BarStore();
    s.set([bar(10), bar(11)]);
    expect(s.prepend([bar(9), bar(8), bar(10)])).toBe(2);
    expect(s.bars.map((b) => b.time)).toEqual([8, 9, 10, 11]);
    expect(s.indexOfTime(9)).toBe(1);
    expect(s.indexOfTime(7)).toBe(-1);
  });
});

describe('TimeScale', () => {
  const make = () => {
    const ts = new TimeScale({ barSpacing: 10, minBarSpacing: 1, maxBarSpacing: 50, rightOffset: 0 });
    ts.width = 1000;
    ts.barCount = 500;
    return ts;
  };

  it('maps index <-> x consistently', () => {
    const ts = make();
    expect(ts.indexToX(499)).toBe(995);
    expect(ts.xToIndex(995)).toBe(499);
    expect(ts.xToIndex(ts.indexToX(420))).toBe(420);
    expect(ts.visibleRange()).toEqual({ from: 400, to: 499 });
  });

  it('zoom keeps the anchor bar under the cursor', () => {
    const ts = make();
    const before = ts.xToIndexFloat(300);
    ts.zoom(300, 2);
    expect(ts.barSpacing).toBe(20);
    expect(ts.xToIndexFloat(300)).toBeCloseTo(before, 9);
  });

  it('pans and clamps so bars stay visible', () => {
    const ts = make();
    ts.pan(100);
    expect(ts.rightOffset).toBe(-10);
    ts.pan(1e9);
    expect(ts.visibleRange().from).toBe(0);
    expect(ts.visibleRange().to).toBeGreaterThanOrEqual(1);
    ts.pan(-1e9);
    expect(ts.visibleRange().to).toBe(499);
  });

  it('keeps rightOffset relative to the last bar (append follows realtime)', () => {
    const ts = make();
    const x = ts.indexToX(499);
    ts.barCount = 501;
    expect(ts.indexToX(500)).toBe(x);
  });
});

describe('PriceScale', () => {
  it('maps price <-> y with margins', () => {
    const s = new PriceScale({ top: 0.1, bottom: 0.1 });
    s.height = 100;
    s.setRange(0, 80);
    expect(s.priceToY(80)).toBe(10);
    expect(s.priceToY(0)).toBe(90);
    expect(s.yToPrice(50)).toBe(40);
  });

  it('lays data out below a top inset', () => {
    const s = new PriceScale({ top: 0, bottom: 0 });
    s.height = 200;
    s.insetTop = 50;
    s.setRange(0, 150);
    expect(s.priceToY(150)).toBe(50);
    expect(s.priceToY(0)).toBe(200);
    expect(s.yToPrice(125)).toBe(75);
    s.insetTop = 180; // never squeezes data into less than half the pane
    expect(s.priceToY(150)).toBe(100);
  });

  it('expands a flat range', () => {
    const s = new PriceScale({ top: 0, bottom: 0 });
    s.setRange(100, 100);
    expect(s.max).toBeGreaterThan(s.min);
  });
});

describe('niceTicks', () => {
  it('produces round steps', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(70_120, 72_480, 5)).toEqual([70_500, 71_000, 71_500, 72_000]);
  });

  it('handles tiny crypto prices without float noise', () => {
    const ticks = niceTicks(0.00001231, 0.00001239, 4);
    expect(ticks).toEqual([0.00001232, 0.00001234, 0.00001236, 0.00001238]);
  });

  it('only uses steps that are multiples of the tick size', () => {
    // rough step 220: 250 isn't a multiple of KRX's 100 tick; 200 is closer than 500
    expect(niceTicks(70_000, 72_200, 10, 100)).toEqual([70_000, 70_200, 70_400, 70_600, 70_800, 71_000, 71_200, 71_400, 71_600, 71_800, 72_000, 72_200]);
    // when 2.5× fits the tick, it is still used
    expect(niceTicks(0, 1000, 4, 50)).toEqual([0, 250, 500, 750, 1000]);
    // crypto 0.01 ticks don't constrain normal steps
    expect(niceTicks(0, 1, 4, 0.01)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('never goes below the instrument tick size', () => {
    const ticks = niceTicks(100, 101, 10, 1);
    expect(ticks).toEqual([100, 101]);
  });
});

describe('time ticks', () => {
  const fmt = new TimeFormatter('Asia/Seoul', 'ko');

  it('resolves parts in the given timezone', () => {
    // 2026-11-09T00:30:00Z = 09:30 KST
    const p = fmt.parts(Date.UTC(2026, 10, 9, 0, 30));
    expect(p).toMatchObject({ year: 2026, month: 11, day: 9, hour: 9, minute: 30, weekday: 1 });
    expect(fmt.crosshairLabel(Date.UTC(2026, 10, 9, 0, 30), true)).toBe('2026.11.09 (월) 09:30');
  });

  it('weights boundaries by significance', () => {
    const p = (iso: string) => fmt.parts(Date.parse(iso));
    expect(boundaryWeight(p('2025-12-31T00:00:00Z'), p('2026-01-01T00:00:00Z'))).toBe(TickWeight.Year);
    expect(boundaryWeight(p('2026-10-31T00:00:00Z'), p('2026-11-01T00:00:00Z'))).toBe(TickWeight.Month);
    expect(boundaryWeight(p('2026-11-09T00:29:00Z'), p('2026-11-09T00:30:00Z'))).toBe(TickWeight.Minute30);
  });

  it('prefers day boundaries and keeps a minimum gap on intraday data', () => {
    const start = Date.UTC(2026, 10, 9, 0, 0); // 09:00 KST
    const bars = Array.from({ length: 200 }, (_, i) => bar(start + i * 5 * 60_000));
    const ts = new TimeScale({ barSpacing: 6, minBarSpacing: 1, maxBarSpacing: 50, rightOffset: 0 });
    ts.width = 1200;
    ts.barCount = bars.length;
    const ticks = computeTimeTicks(bars, ts, fmt, 72);
    expect(ticks.length).toBeGreaterThan(5);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]!.x - ticks[i - 1]!.x).toBeGreaterThanOrEqual(72);
    expect(ticks.some((t) => t.label === '10일')).toBe(true);
  });
});
