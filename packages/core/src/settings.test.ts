import { describe, expect, it } from 'vitest';
import { CHART_THEMES, DEFAULT_CHART_SETTINGS, matchChartTheme, parseChartState } from './settings';

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

describe('chart themes', () => {
  it('defaults follow the page theme', () => {
    expect(matchChartTheme(DEFAULT_CHART_SETTINGS)?.id).toBe('default');
  });

  it('recognises an applied preset (any hex case) and nothing for custom colors', () => {
    const midnight = CHART_THEMES.find((t) => t.id === 'midnight')!;
    const applied = { ...DEFAULT_CHART_SETTINGS, ...midnight.colors, upColor: midnight.colors.upColor!.toLowerCase() };
    expect(matchChartTheme(applied)?.id).toBe('midnight');
    expect(matchChartTheme({ ...applied, upColor: '#123456' })).toBeUndefined();
  });

  it('every preset sets all five colors (null = follow) and text as #rrggbb', () => {
    const ids = new Set<string>();
    for (const t of CHART_THEMES) {
      expect(Object.keys(t.colors).sort()).toEqual(['background', 'downColor', 'gridColor', 'textColor', 'upColor']);
      if (t.colors.textColor) expect(t.colors.textColor).toMatch(/^#[0-9a-f]{6}$/i);
      ids.add(t.id);
    }
    expect(ids.size).toBe(CHART_THEMES.length);
  });

  it('older saved states get the new color settings as null', () => {
    const s = parseChartState({ version: 1, settings: { upColor: '#ff0000' } });
    expect(s.settings).toMatchObject({ upColor: '#ff0000', background: null, gridColor: null, textColor: null });
  });
});
