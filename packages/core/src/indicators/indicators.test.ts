import { describe, expect, it } from 'vitest';
import { INDICATORS } from './definitions.js';
import { IndicatorManager } from './manager.js';
import { bollinger, ema, macd, rsi, sma } from './math.js';

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

  it('moves an indicator up or down among its own kind', () => {
    const m = new IndicatorManager();
    const ma = m.add('ma');
    const rsi = m.add('rsi');
    const ema = m.add('ema');
    const macd = m.add('macd');
    // Overlays: ma, ema. Panes: rsi, macd.
    expect([m.canMove(ma, -1), m.canMove(ma, 1), m.canMove(ema, 1)]).toEqual([false, true, false]);
    expect(m.move(ema, -1)).toBe(true);
    expect(m.overlays.map((c) => c.id)).toEqual([ema, ma]);
    expect(m.panes.map((c) => c.id)).toEqual([rsi, macd]); // panes untouched
    expect(m.move(rsi, 1)).toBe(true);
    expect(m.panes.map((c) => c.id)).toEqual([macd, rsi]);
    expect(m.move(rsi, 1)).toBe(false); // already last
    expect(m.move('nope', 1)).toBe(false);
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

  it('지표 위에 지표: an MA over RSI reads the RSI, lives in its pane, goes with it', () => {
    const m = new IndicatorManager();
    const long = Array.from({ length: 80 }, (_, i) => ({ time: i * 60_000, open: 100, high: 101, low: 99, close: 100 + Math.sin(i / 3) * 5, volume: 1 }));
    const r = m.add('rsi');
    const ma = m.addOn('ma', { lines: [{ period: 5, source: 'close' }] }, { id: r })!;
    expect(ma).toBeTruthy();
    expect(m.list.find((c) => c.id === ma)!.on).toEqual({ id: r, key: 'rsi' });
    // Not an overlay, not a pane of its own: drawn in the RSI pane.
    expect([m.overlays.length, m.panes.map((c) => c.id), m.childrenOf(r).map((c) => c.id)]).toEqual([0, [r], [ma]]);
    const rsiValues = m.output(m.list[0]!, long, 1).series[0]!.values;
    const maValues = m.output(m.list[1]!, long, 1).series[0]!.values;
    // RSI 14 starts at bar 14; its MA 5 four bars later, and equals the mean of the last five RSI values.
    expect([Number.isNaN(maValues[17]!), Number.isNaN(maValues[18]!)]).toEqual([true, false]);
    const mean = (rsiValues[75]! + rsiValues[76]! + rsiValues[77]! + rsiValues[78]! + rsiValues[79]!) / 5;
    expect(maValues[79]).toBeCloseTo(mean, 9);

    // Only types that read one series; never on something that is itself on an indicator.
    expect(m.addOn('rsi', undefined, { id: r })).toBeNull();
    expect(m.addOn('ema', undefined, { id: ma })).toBeNull();
    expect(m.addOn('ema', undefined, { id: 'nope' })).toBeNull();
    // On an overlay: it's an overlay too.
    const bb = m.add('bb');
    const onBb = m.addOn('ema', { lines: [{ period: 3, source: 'close' }] }, { id: bb, key: 'middle' })!;
    expect(m.overlays.map((c) => c.id)).toEqual([bb, onBb]);

    // Saved and restored with it; restored without its parent, it's dropped.
    const saved = m.snapshot();
    const back = new IndicatorManager();
    back.set(saved);
    expect(back.list.map((c) => c.on?.id ?? null)).toEqual([null, r, null, bb]);
    back.set(saved.filter((c) => c.id !== r));
    expect(back.list.map((c) => c.id)).toEqual([bb, onBb]);

    // Removing the RSI removes the MA on it.
    m.remove(r);
    expect(m.list.map((c) => c.id)).toEqual([bb, onBb]);
  });

  it('migrates the legacy periods shape', () => {
    const m = new IndicatorManager();
    m.set([{ id: 'x', type: 'ma', params: { periods: [7, 14] as unknown as never } }]);
    expect(m.list[0]!.params).toEqual({ lines: [{ period: 7, source: 'close' }, { period: 14, source: 'close' }] });
  });
});

describe('long moving averages', () => {
  it('take periods past 1000 (1792일선)', () => {
    for (const type of ['ma', 'ema'] as const) {
      const spec = INDICATORS[type].params.find((p) => p.key === 'lines')!;
      expect(spec.max).toBeGreaterThanOrEqual(1792);
    }
    expect(INDICATORS.ma.lookback!({ lines: [{ period: 1792, source: 'close' }] })).toBe(1792);
  });
});

describe('lookback: bars an indicator needs behind a value', () => {
  // A long random walk: the "true" value at the end is the one computed from all of it.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const closes: number[] = [];
  for (let i = 0, p = 100; i < 6000; i++) closes.push((p += rand() * 2));
  const last = (a: Float64Array) => a[a.length - 1]!;

  it('built-ins say how far back they reach', () => {
    expect(INDICATORS.ma.lookback!({ lines: [{ period: 120, source: 'close' }] })).toBe(120);
    expect(INDICATORS.ema.lookback!({ lines: [{ period: 200, source: 'close' }] })).toBe(904);
    expect(INDICATORS.rsi.lookback!({ period: 14, source: 'close' })).toBe(112);
    expect(INDICATORS.bb.lookback!({ period: 20, mult: 2, source: 'close' })).toBe(20);
    expect(INDICATORS.macd.lookback!({ fast: 12, slow: 26, signal: 9, source: 'close' })).toBeGreaterThan(26 + 9);
  });

  it('with that many bars the value matches the one from the whole history (within 0.1%)', () => {
    for (const n of [20, 50, 200]) {
      const k = INDICATORS.ema.lookback!({ lines: [{ period: n, source: 'close' }] });
      const full = last(ema(closes, n));
      expect(Math.abs(last(ema(closes.slice(-k), n)) - full) / Math.abs(full)).toBeLessThan(0.001);
    }
    for (const n of [14, 30]) {
      const k = INDICATORS.rsi.lookback!({ period: n, source: 'close' });
      expect(Math.abs(last(rsi(closes.slice(-k), n)) - last(rsi(closes, n)))).toBeLessThan(0.1);
    }
    // 300 bars (what a chart first loads) leave an EMA 200 still leaning on its first guess: off
    // by far more than with its lookback (the gap shows most right where two lines cross).
    const full = last(ema(closes, 200));
    const err300 = Math.abs(last(ema(closes.slice(-300), 200)) - full);
    const errLookback = Math.abs(last(ema(closes.slice(-904), 200)) - full);
    expect(err300).toBeGreaterThan(10 * errLookback);
  });
});
