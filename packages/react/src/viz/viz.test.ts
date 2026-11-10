import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { YAxis } from './axes';
import { CartesianChart } from './cartesian-chart';
import { BarChart, LineChart, PercentageBarChart } from './charts';
import { useCartesianChart } from './context';

const render = (el: ReturnType<typeof h>) => renderToStaticMarkup(el);

describe('range data', () => {
  it('includes the low ends in the y domain and splits [low, high]', () => {
    let seen: { domain: readonly number[]; low: readonly (number | null)[] | null; high: readonly (number | null)[] } | null = null;
    const Probe = () => {
      const ctx = useCartesianChart();
      seen = { domain: ctx.y.domain, low: ctx.series[0]!.low, high: ctx.series[0]!.data };
      return null;
    };
    render(
      h(CartesianChart, { width: 300, height: 200, series: [{ id: 'band', data: [[10, 20], [25, 15], null] as const }] }, h(Probe)),
    );
    expect(seen!.low).toEqual([10, 15, null]);
    expect(seen!.high).toEqual([20, 25, null]);
    expect(Math.min(...seen!.domain)).toBeLessThanOrEqual(10);
    expect(Math.max(...seen!.domain)).toBeGreaterThanOrEqual(25);
  });

  it('draws a band (area between the ends) and floating bars', () => {
    const band = render(h(LineChart, { width: 300, height: 200, area: 'solid', series: [{ id: 'ci', data: [[1, 3], [2, 5], [3, 4]] }] }));
    expect(band).toContain('<path');
    const bars = render(h(BarChart, { width: 300, height: 200, series: [{ id: 'hl', data: [[10, 20], [12, 18]] }] }));
    expect((bars.match(/<path/g) ?? []).length).toBe(2);
  });
});

describe('multiple y axes', () => {
  it('gives each axis its own scale', () => {
    let scales: Record<string, { domain: readonly number[] }> = {};
    const Probe = () => {
      const ctx = useCartesianChart();
      scales = Object.fromEntries(ctx.series.map((s) => [s.id, s.scale]));
      return null;
    };
    render(
      h(
        CartesianChart,
        {
          width: 300,
          height: 200,
          yAxis: [{ id: 'price' }, { id: 'volume', includeZero: true }],
          series: [
            { id: 'p', yAxisId: 'price', data: [100, 110, 105] },
            { id: 'v', yAxisId: 'volume', data: [5e6, 8e6, 6e6] },
          ],
        },
        h(YAxis, { axisId: 'price' }),
        h(YAxis, { axisId: 'volume', position: 'left' }),
        h(Probe),
      ),
    );
    expect(Math.max(...scales.p!.domain)).toBeLessThan(1000);
    expect(Math.max(...scales.v!.domain)).toBeGreaterThanOrEqual(8e6);
    expect(Math.min(...scales.v!.domain)).toBe(0);
  });
});

describe('horizontal bars and percentage rows', () => {
  it('renders one row per category', () => {
    const svg = render(
      h(BarChart, { layout: 'horizontal', width: 300, xAxis: { data: ['A', 'B', 'C'] }, series: [{ id: 's', data: [3, -1, 2] }] }),
    );
    expect((svg.match(/<path/g) ?? []).length).toBe(3);
    expect(svg).toContain('>A<');
  });

  it('renders several percentage bars with one legend', () => {
    const html = render(
      h(PercentageBarChart, {
        rows: [
          { id: 'a', label: '1월', data: [{ id: 'x', label: 'X', value: 1 }, { id: 'y', label: 'Y', value: 3 }] },
          { id: 'b', label: '2월', data: [{ id: 'y', label: 'Y', value: 1 }, { id: 'x', label: 'X', value: 1 }] },
        ],
      }),
    );
    expect(html).toContain('1월');
    expect(html).toContain('X 25%');
    expect(html).toContain('X 50%');
  });
});
