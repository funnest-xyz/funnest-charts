import { describe, expect, it } from 'vitest';
import { isIntradayResolution, resolutionToMs } from './resolution';

describe('resolution', () => {
  it('parses TradingView-style resolutions', () => {
    expect(resolutionToMs('1')).toBe(60_000);
    expect(resolutionToMs('240')).toBe(240 * 60_000);
    expect(resolutionToMs('1D')).toBe(86_400_000);
    expect(resolutionToMs('D')).toBe(86_400_000);
    expect(resolutionToMs('1W')).toBe(7 * 86_400_000);
    expect(isIntradayResolution('60')).toBe(true);
    expect(isIntradayResolution('1D')).toBe(false);
    expect(() => resolutionToMs('abc')).toThrow();
  });
});

describe('fallbackResolution', () => {
  it('keeps supported resolutions and steps down to the nearest shorter one', async () => {
    const { fallbackResolution } = await import('./chart');
    const binance = ['1', '5', '15', '60', '240', '1D', '1W', '1M'];
    expect(fallbackResolution('5', binance)).toBe('5');
    expect(fallbackResolution('3M', binance)).toBe('1M');
    expect(fallbackResolution('30', binance)).toBe('15');
    expect(fallbackResolution('5', undefined)).toBe('5');
    expect(fallbackResolution('1', ['1D', '1W'])).toBe('1D');
  });
});
