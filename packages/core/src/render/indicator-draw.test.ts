import { describe, expect, it } from 'vitest';
import type { IndicatorOutput } from '../indicators/definitions.js';
import { barColorOf, graphicsRange, hasAlpha } from './indicator-draw.js';

describe('indicator graphics helpers', () => {
  it('knows colors that carry their own alpha', () => {
    expect(['#12B88633', 'rgba(0,0,0,0.2)', 'hsla(0 0% 0% / 0.3)', 'rgb(0 0 0 / 50%)'].map(hasAlpha)).toEqual([true, true, true, true]);
    expect(['#12B886', 'red', 'var(--up)', 'up'].map(hasAlpha)).toEqual([false, false, false, false]);
  });

  it('takes a candle color from the last indicator that sets one', () => {
    const a: IndicatorOutput = { series: [], precision: null, barColors: { palette: ['#111111'], index: Uint8Array.from([0, 255, 0]) } };
    const b: IndicatorOutput = { series: [], precision: null, barColors: { palette: ['#222222'], index: Uint8Array.from([255, 255, 0]) } };
    expect([0, 1, 2].map((i) => barColorOf([a, b], i))).toEqual(['#111111', null, '#222222']);
  });

  it('measures what graphics reach on screen', () => {
    const r = graphicsRange(
      {
        lines: [{ x1: 2, y1: 10, x2: 5, y2: 20, color: 'red', width: 1, style: 'solid', extend: 'none' }],
        boxes: [{ left: 50, top: 99, right: 60, bottom: 90, width: 1, style: 'solid', extend: 'right' }],
        labels: [{ bar: 100, text: 'far', location: 'price', price: 1000, style: 'box', align: 'center', size: 'small' }],
      },
      0,
      10,
    );
    // The far label is off screen; an extended box always counts.
    expect(r).toEqual([10, 99]);
    expect(graphicsRange(undefined, 0, 10)).toBeNull();
  });
});

describe('indicator colors', () => {
  it("'up' / 'down' are the palette's, with an optional opacity", async () => {
    const { resolveIndicatorColor, withAlpha } = await import('./indicator-draw.js');
    const r = (v: string) => resolveIndicatorColor(v, '#F04452', 'rgb(49, 130, 246)', (c) => `resolved:${c}`);
    expect([r('up'), r('down'), r('up/0.2'), r('down/0.5'), r('var(--x)'), r('#123456')]).toEqual([
      '#F04452',
      'rgb(49, 130, 246)',
      '#F0445233',
      'rgba(49, 130, 246, 0.5)',
      'resolved:var(--x)',
      'resolved:#123456',
    ]);
    expect(withAlpha('#abc', 1)).toBe('#aabbccff');
  });
});
