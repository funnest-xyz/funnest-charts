import { describe, expect, it } from 'vitest';
import { decimalsOf, formatCompact, formatPrice, krxTickSize, roundToTick } from './price';

describe('decimalsOf', () => {
  it('counts decimals including exponent notation', () => {
    expect(decimalsOf(100)).toBe(0);
    expect(decimalsOf(0.01)).toBe(2);
    expect(decimalsOf(0.00000001)).toBe(8);
    expect(decimalsOf(1.5e-7)).toBe(8);
  });
});

describe('roundToTick', () => {
  it('avoids floating point drift', () => {
    expect(roundToTick(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundToTick(1.005, 0.01)).toBe(1.01);
  });

  it('handles crypto-scale ticks', () => {
    expect(roundToTick(0.000012344, 0.00000001)).toBe(0.00001234);
  });

  it('supports price-dependent KRX ticks', () => {
    expect(roundToTick(71_234, krxTickSize)).toBe(71_200);
    expect(roundToTick(4_998, krxTickSize)).toBe(5_000);
    expect(roundToTick(612_345, krxTickSize)).toBe(612_000);
  });
});

describe('formatPrice', () => {
  it('formats with thousands separators and precision', () => {
    expect(formatPrice(71200, 0)).toBe('71,200');
    expect(formatPrice(98765.4321, 2)).toBe('98,765.43');
    expect(formatPrice(-1234.5, 1)).toBe('-1,234.5');
    expect(formatPrice(-0.0001, 2)).toBe('0.00');
    expect(formatPrice(1234, 0, { thousandsSeparator: false })).toBe('1234');
  });
});

describe('formatCompact', () => {
  it('uses 만/억 for ko and K/M/B for en', () => {
    expect(formatCompact(1_200_000, 'ko')).toBe('120만');
    expect(formatCompact(1_234_567, 'ko')).toBe('123만');
    expect(formatCompact(350_000_000, 'ko')).toBe('3.5억');
    expect(formatCompact(1_234_567, 'en')).toBe('1.23M');
    expect(formatCompact(999, 'en')).toBe('999');
    expect(formatCompact(0.5, 'en')).toBe('0.5');
  });
});
