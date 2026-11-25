import { describe, expect, it } from 'vitest';
import { PriceScale } from './price-scale.js';

describe('가격 축 비율 고정 helpers', () => {
  it('per-pixel span is kept around the same center', () => {
    const s = new PriceScale({ top: 0, bottom: 0 });
    s.height = 200;
    s.setRange(100, 300);
    expect(s.axisPerPixel).toBeCloseTo(1);
    s.setAxisPerPixel(0.5);
    expect(s.min).toBeCloseTo(150);
    expect(s.max).toBeCloseTo(250);
    expect(s.autoScale).toBe(false);
    // Nonsense leaves it be.
    s.setAxisPerPixel(0);
    expect(s.max).toBeCloseTo(250);
  });

  it('log axes keep it in log units', () => {
    const s = new PriceScale({ top: 0, bottom: 0 });
    s.height = 100;
    s.mode = 'log';
    s.setRange(100, 10_000);
    const per = s.axisPerPixel;
    s.setAxisPerPixel(per / 2);
    // Half the log span around the geometric center (1,000): 10^(2..4) → 10^(2.5..3.5).
    expect(s.min).toBeCloseTo(10 ** 2.5, 3);
    expect(s.max).toBeCloseTo(10 ** 3.5, 3);
  });
});
