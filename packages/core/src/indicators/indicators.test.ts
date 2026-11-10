import { describe, expect, it } from 'vitest';
import { INDICATORS } from './definitions';
import { IndicatorManager } from './manager';
import { bollinger, ema, macd, rsi, sma } from './math';

const arr = (a: Float64Array) => Array.from(a, (v) => (Number.isNaN(v) ? null : Math.round(v * 1e6) / 1e6));

describe('indicator math', () => {
  it('sma', () => {
    expect(arr(sma([1, 2, 3, 4, 5], 3))).toEqual([null, null, 2, 3, 4]);
  });

  it('ema seeds with the SMA and skips leading NaNs', () => {
    // k = 0.5: seed (1+2+3)/3 = 2, then 4*.5+2*.5 = 3, then 5*.5+3*.5 = 4
    expect(arr(ema([1, 2, 3, 4, 5], 3))).toEqual([null, null, 2, 3, 4]);
    expect(arr(ema([NaN, NaN, 2, 4], 2))).toEqual([null, null, null, 3]);
  });

  it('bollinger bands are symmetric around the SMA', () => {
    const { middle, upper, lower } = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2);
    // population stdev of this classic sample is exactly 2
    expect(middle[7]).toBe(5);
    expect(upper[7]).toBe(9);
    expect(lower[7]).toBe(1);
  });

  it('rsi: 100 for only gains, 0 for only losses, Wilder smoothing otherwise', () => {
    expect(rsi([1, 2, 3, 4, 5, 6], 3)[5]).toBe(100);
    expect(rsi([6, 5, 4, 3, 2, 1], 3)[5]).toBe(0);
    // Wilder smoothing by hand: avgGain 0.45117, avgLoss 0.54883 → 45.117
    expect(rsi([1, 2, 1, 2, 1, 2, 1, 2, 1], 4)[8]).toBeCloseTo(45.117, 2);
  });

  it('macd histogram = macd - signal', () => {
    const src = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10);
    const m = macd(src, 12, 26, 9);
    expect(Number.isNaN(m.macd[24]!)).toBe(true);
    expect(Number.isNaN(m.macd[25]!)).toBe(false);
    expect(Number.isNaN(m.signal[32]!)).toBe(true);
    expect(m.histogram[59]).toBeCloseTo(m.macd[59]! - m.signal[59]!, 10);
  });
});

describe('IndicatorManager', () => {
  const bars = Array.from({ length: 50 }, (_, i) => ({ time: i, open: i + 1, high: i + 2, low: i, close: i }));

  it('adds with defaults, splits overlays/panes, caches by data version', () => {
    const m = new IndicatorManager();
    const ma = m.add('ma');
    const r = m.add('rsi', { period: 7 });
    expect(m.overlays.map((c) => c.id)).toEqual([ma]);
    expect(m.panes.map((c) => c.id)).toEqual([r]);
    expect(m.list[1]!.params).toEqual({ period: 7, source: 'close' });

    const cfg = m.list[0]!;
    const a = m.output(cfg, bars, 1);
    expect(m.output(cfg, bars, 1)).toBe(a);
    expect(m.output(cfg, bars, 2)).not.toBe(a);
    expect(a.series.map((s) => s.label)).toEqual(['MA5', 'MA20', 'MA60', 'MA120']);
    expect(a.series[0]!.values[4]).toBe(2);
    expect(m.remove(r)).toBe(true);
    expect(m.panes).toHaveLength(0);
  });

  it('supports per-line period, source, width, color and visibility', () => {
    const m = new IndicatorManager();
    const id = m.add('ma');
    m.update(id, {
      params: { lines: [{ period: 3, source: 'high' }, { period: 10, source: 'close' }] },
      styles: { l0: { width: 3, color: '#000000' }, l1: { visible: false } },
    });
    const cfg = m.list[0]!;
    expect(INDICATORS.ma.title(cfg.params)).toBe('MA 3·10');
    const out = m.output(cfg, bars, 1);
    expect(out.series[0]).toMatchObject({ label: 'MA3(H)', width: 3, color: '#000000', visible: true });
    expect(out.series[0]!.values[2]).toBe(3); // highs 2,3,4 → 3
    expect(out.series[1]!.visible).toBe(false);

    m.update(id, { visible: false });
    expect(m.list[0]!.visible).toBe(false);
  });

  it('migrates the legacy periods shape', () => {
    const m = new IndicatorManager();
    m.set([{ id: 'x', type: 'ma', params: { periods: [7, 14] as unknown as never } }]);
    expect(m.list[0]!.params).toEqual({ lines: [{ period: 7, source: 'close' }, { period: 14, source: 'close' }] });
  });
});
