import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCsv, suggestCharts } from './data';
import { reactCode, renderSvg } from './render';
import { systemLocale } from './i18n';
import { CHART_TYPES, chartSchema, closest, exampleSpec, validateSpec } from './spec';

describe('spec validation', () => {
  it('accepts every example', () => {
    for (const t of CHART_TYPES) expect(validateSpec(exampleSpec(t))).toEqual([]);
  });
  it('suggests the closest chart type and field', () => {
    expect(validateSpec({ type: 'lnie', data: [{ a: 1 }] })[0]!.message).toContain('"line"');
    const issues = validateSpec({ type: 'line', data: [{ date: 'x', price: 1 }], y: 'prcie', colour: 'red' });
    expect(issues.map((i) => i.path).sort()).toEqual(['colour', 'y']);
    expect(issues.find((i) => i.path === 'y')!.message).toContain('"price"');
  });
  it('rejects non-numeric y columns and empty data', () => {
    expect(validateSpec({ type: 'bar', data: [{ n: 'a', v: 'x' }], y: 'v' })[0]!.message).toContain('숫자');
    expect(validateSpec({ type: 'bar', data: [], y: 'v' }, 'en')[0]!.message).toBe('data: is empty.');
  });
  it('closest() ignores far-off words', () => {
    expect(closest('colour', ['colors', 'x'])).toBe('colors');
    expect(closest('zzzz', ['line', 'bar'])).toBeNull();
  });
  it('JSON schema lists required fields and forbids extras', () => {
    const s = chartSchema('percentage-bar');
    expect(s.required).toEqual(['type', 'data', 'label', 'value']);
    expect(s.additionalProperties).toBe(false);
  });
});

describe('data', () => {
  it('parses quoted CSV with thousands separators', () => {
    expect(parseCsv('name,price\n"Samsung, Inc",71200\nSK,"182,400"\n')).toEqual([
      { name: 'Samsung, Inc', price: 71200 },
      { name: 'SK', price: 182400 },
    ]);
  });
  it('suggests signed bars for P&L and a line for prices', () => {
    const rows = [
      { date: '2026-11-03', close: 71200, pnl: 12000 },
      { date: '2026-11-04', close: 71800, pnl: -3000 },
    ];
    const types = suggestCharts(rows).map((s) => `${s.spec.type}:${String(s.spec.y)}`);
    expect(types).toContain('line:close');
    expect(types).toContain('bar:pnl');
  });
  it('suggests a percentage bar for a few categories', () => {
    expect(suggestCharts([{ a: 'x', v: 1 }, { a: 'y', v: 2 }])[0]!.spec.type).toBe('percentage-bar');
  });
});

describe('render', () => {
  it('renders standalone SVG with concrete colors (no CSS variables)', () => {
    for (const t of CHART_TYPES) {
      const svg = renderSvg(exampleSpec(t), { theme: 'dark' });
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).not.toContain('var(--');
      expect(svg).toContain('#17171c');
    }
  });
  it('generates React code for the same chart', () => {
    const code = reactCode(exampleSpec('bar'));
    expect(code).toContain("import { BarChart, ReferenceLine } from '@funnest/charts-react'");
    expect(code).toContain('getBarColor');
  });
  it('suggests candles for OHLC columns and a market map for size + change', () => {
    const ohlc = suggestCharts([
      { date: '2026-11-03', 시가: 100, 고가: 110, 저가: 95, 종가: 108, 거래량: 1000 },
      { date: '2026-11-04', 시가: 108, 고가: 112, 저가: 101, 종가: 102, 거래량: 1500 },
    ]);
    expect(ohlc[0]!.spec).toMatchObject({ type: 'candlestick', open: '시가', close: '종가', volume: '거래량', x: 'date' });
    const market = suggestCharts(['A', 'B', 'C', 'D'].map((name, i) => ({ name, cap: 10 + i, pct: i % 2 ? -1.5 : 2 })));
    expect(market.map((s) => s.spec.type)).toContain('treemap');
    expect(market.map((s) => s.spec.type)).toContain('donut');
  });
  it('generates React code for candles, donut and treemap', () => {
    expect(reactCode(exampleSpec('candlestick'))).toContain('<CandlestickChart');
    expect(reactCode(exampleSpec('donut'))).toContain('totalLabel="총 자산"');
    expect(reactCode(exampleSpec('treemap'))).toContain('change: d["pct"]');
  });
  it('renders horizontal bars (one row per category)', () => {
    const spec = { type: 'bar' as const, layout: 'horizontal' as const, data: [{ s: 'A', r: 3 }, { s: 'B', r: -1 }], x: 's', y: 'r' };
    expect(validateSpec(spec)).toEqual([]);
    const svg = renderSvg(spec);
    expect((svg.match(/<path/g) ?? []).length).toBe(2);
    expect(svg).toContain('>A<');
    expect(reactCode(spec)).toContain('layout="horizontal"');
  });
});

describe('message language', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('follows the machine: Korean for a Korean system, English otherwise', () => {
    vi.stubEnv('LC_ALL', '');
    vi.stubEnv('LC_MESSAGES', '');
    vi.stubEnv('LANG', 'ko_KR.UTF-8');
    expect(systemLocale()).toBe('ko');
    vi.stubEnv('LANG', 'en_US.UTF-8');
    expect(systemLocale()).toBe('en');
    vi.stubEnv('LC_ALL', 'ko_KR.UTF-8');
    expect(systemLocale()).toBe('ko');
  });
});
