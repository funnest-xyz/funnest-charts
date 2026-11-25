import { describe, expect, it } from 'vitest';
import type { Bar } from '../types.js';
import { IndicatorManager, intervalUnit, shownOnInterval } from './manager.js';
import { composeHigher, mapToHigher, periodEnd } from './timeframe.js';

const H = 3_600_000;
const bar = (time: number, close: number, volume = 1): Bar => ({ time, open: close, high: close + 1, low: close - 1, close, volume });

describe('타임프레임', () => {
  it('period ends: fixed lengths, calendar months', () => {
    expect(periodEnd(0, '240')).toBe(4 * H);
    expect(periodEnd(Date.UTC(2026, 0, 1), '1M')).toBe(Date.UTC(2026, 1, 1));
    expect(periodEnd(Date.UTC(2026, 0, 31), '1W')).toBe(Date.UTC(2026, 1, 7));
  });

  it('the last fetched bar follows the chart; new periods are built from it', () => {
    // 4h bars fetched at 0h and 4h (the 4h one still forming when fetched).
    const fetched = [bar(0, 10, 40), bar(4 * H, 20, 5)];
    // Chart: hourly, 4h..9h.
    const chart = [4, 5, 6, 7, 8, 9].map((h) => bar(h * H, 20 + h, 2));
    const higher = composeHigher(fetched, chart, '240');
    expect(higher.map((b) => b.time)).toEqual([0, 4 * H, 8 * H]);
    expect(higher[1]!.close).toBe(27);
    expect(higher[1]!.high).toBe(28);
    // Fetched volume kept unless the chart's own add up to more.
    expect(higher[1]!.volume).toBe(8);
    expect(higher[2]).toMatchObject({ open: 28, close: 29, volume: 4 });
  });

  it('lines chart bars up: the period they are in, or (waiting for the close) the last closed one', () => {
    const higher = [bar(0, 1), bar(4 * H, 2), bar(8 * H, 3)];
    const chart = [2, 3, 4, 5, 6, 7, 8, 9].map((h) => bar(h * H, 0));
    expect([...mapToHigher(chart, higher, '240', false)]).toEqual([0, 0, 1, 1, 1, 1, 2, 2]);
    // 2h: nothing closed yet; 3h ends 0–4h and shows it; 7h ends 4h–8h; the live 9h bar shows 4h–8h.
    expect([...mapToHigher(chart, higher, '240', true)]).toEqual([-1, 0, 0, 0, 0, 1, 1, 1]);
    // Before the first higher bar: nothing.
    expect([...mapToHigher([bar(-H, 0)], higher, '240', false)]).toEqual([-1]);
  });

  it('an indicator on a timeframe is computed on its bars and spread over the chart bars', () => {
    const m = new IndicatorManager();
    const id = m.add('ma', { lines: [{ period: 2, source: 'close' }] });
    const cfg = m.list.find((c) => c.id === id)!;
    m.update(id, { timeframe: '240' });
    const higher = [bar(0, 10), bar(4 * H, 20), bar(8 * H, 40)];
    m.timeframeSource = (c) => (c.timeframe ? { key: 'k', get: () => ({ bars: higher, index: Int32Array.from([0, 1, 1, 2]) }) } : null);
    const out = m.output(cfg, [0, 4, 5, 8].map((h) => bar(h * H, 0)), 1);
    expect([...out.series[0]!.values]).toEqual([Number.NaN, 15, 15, 30]);
  });
});

describe('표시 설정', () => {
  it('line style, plot type, precision, levels and fill', () => {
    const m = new IndicatorManager();
    const rsi = m.add('rsi');
    m.update(rsi, { styles: { rsi: { lineStyle: 'dashed', kind: 'step' } }, display: { precision: 4, levelColor: '#FF0000' } });
    const bars = Array.from({ length: 40 }, (_, i) => bar(i * H, 100 + Math.sin(i)));
    const out = m.output(m.list[0]!, bars, 1);
    const s = out.series.find((x) => x.key === 'rsi') ?? out.series[0]!;
    expect(s.lineStyle).toBe('dashed');
    expect(s.kind).toBe('step');
    expect(out.precision).toBe(4);
    expect(out.levels!.every((l) => typeof l === 'object' && l.color === '#FF0000')).toBe(true);
    m.update(rsi, { display: { levels: false } });
    expect(m.output(m.list[0]!, bars, 1).levels).toBeUndefined();

    const bb = m.add('bb');
    m.update(bb, { display: { fill: false } });
    expect(m.output(m.list[1]!, bars, 1).fill).toBeUndefined();
  });

  it('보임: by interval unit and range', () => {
    expect(intervalUnit('240')).toEqual({ unit: 'hours', n: 4 });
    expect(intervalUnit('15')).toEqual({ unit: 'minutes', n: 15 });
    expect(intervalUnit('1D')).toEqual({ unit: 'days', n: 1 });
    const v = { minutes: [1, 15] as [number, number], days: false as const };
    expect(shownOnInterval(v, '5')).toBe(true);
    expect(shownOnInterval(v, '30')).toBe(false);
    expect(shownOnInterval(v, '1D')).toBe(false);
    expect(shownOnInterval(v, '60')).toBe(true);
    expect(shownOnInterval(undefined, '1D')).toBe(true);
  });
});
