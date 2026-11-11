import { describe, expect, it } from 'vitest';
import { logTicks, PriceScale } from './price-scale';

const scale = (mode: PriceScale['mode']) => {
  const s = new PriceScale({ top: 0, bottom: 0 });
  s.height = 400;
  s.mode = mode;
  s.setRange(10, 1000);
  return s;
};

describe('PriceScale modes', () => {
  it('log: equal ratios get equal distances and y round-trips', () => {
    const s = scale('log');
    expect(s.priceToY(1000)).toBeCloseTo(0);
    expect(s.priceToY(10)).toBeCloseTo(400);
    expect(s.priceToY(100)).toBeCloseTo(200);
    expect(s.yToPrice(s.priceToY(321))).toBeCloseTo(321);
  });

  it('log: zero or negative minimums are lifted', () => {
    const s = scale('log');
    s.setRange(-5, 1000);
    expect(s.min).toBeGreaterThan(0);
    expect(Number.isFinite(s.priceToY(500))).toBe(true);
  });

  it('log: zoom and pan work in log space', () => {
    const s = scale('log');
    s.pan(200); // content moves down by half the pane = one decade
    expect(s.max).toBeCloseTo(10000);
    expect(s.min).toBeCloseTo(100);
  });

  it('percent stays linear (only labels differ)', () => {
    const s = scale('percent');
    expect(s.priceToY(505)).toBeCloseTo(200);
  });

  it('logTicks gives readable, increasing, spaced values', () => {
    const s = scale('log');
    const ticks = logTicks(s, 48);
    expect(ticks.length).toBeGreaterThan(3);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
      expect(s.priceToY(ticks[i - 1]!) - s.priceToY(ticks[i]!)).toBeGreaterThanOrEqual(48 * 0.6 - 1e-9);
    }
    for (const t of ticks) expect(Number(t.toPrecision(3))).toBe(t);
  });
});
