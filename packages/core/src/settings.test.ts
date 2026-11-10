import { describe, expect, it } from 'vitest';
import { DEFAULT_CHART_SETTINGS, parseChartState } from './settings';

describe('parseChartState', () => {
  it('fills defaults and validates fields', () => {
    const s = parseChartState({ version: 1, chartType: 'nope', settings: { volume: false }, view: { barSpacing: 12 } });
    expect(s.chartType).toBe('candles');
    expect(s.settings).toEqual({ ...DEFAULT_CHART_SETTINGS, volume: false });
    expect(s.view).toEqual({ barSpacing: 12, rightOffset: 5 });
    expect(s.drawings).toEqual({});
    expect(s.symbol).toBeNull();
  });

  it('rejects unknown versions and garbage', () => {
    expect(() => parseChartState({ version: 2 })).toThrow();
    expect(() => parseChartState(null)).toThrow();
    expect(() => parseChartState('x')).toThrow();
  });

  it('round-trips through JSON', () => {
    const state = parseChartState({
      version: 1,
      symbol: 'A',
      resolution: '1D',
      chartType: 'area',
      settings: DEFAULT_CHART_SETTINGS,
      indicators: [{ id: 'i', type: 'rsi', params: { period: 14 } }],
      drawings: { A: [{ id: 'd', type: 'horizontal', points: [{ time: 1, price: 2 }] }] },
      view: { barSpacing: 6, rightOffset: -3 },
    });
    expect(parseChartState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});
