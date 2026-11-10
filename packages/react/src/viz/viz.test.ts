import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { YAxis } from './axes';
import { CartesianChart } from './cartesian-chart';
import { BarChart, LineChart, PercentageBarChart } from './charts';
import { useCartesianChart } from './context';
import { CandlestickChart } from './candles';
import { DonutChart } from './donut';
import { TreemapChart } from './treemap';

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

describe('donut, treemap, candles', () => {
  const items = [
    { id: 'kr', label: '국내', value: 60 },
    { id: 'us', label: '해외', value: 30 },
    { id: 'cash', label: '현금', value: 10 },
  ];
  it('draws a segment per positive item and the total in the hole', () => {
    const html = render(h(DonutChart, { data: [...items, { id: 'z', label: 'Z', value: 0 }], totalLabel: '총 자산' }));
    expect((html.match(/<path/g) ?? []).length).toBe(3);
    expect(html).toContain('>100<');
    expect(html).toContain('총 자산');
    expect(html).toContain('60%');
  });
  it('lays out treemap tiles colored by change', () => {
    const html = render(
      h(TreemapChart, {
        width: 400,
        height: 200,
        data: [
          { id: 'a', label: '삼성전자', value: 400, change: 2.5 },
          { id: 'b', label: 'SK하이닉스', value: 150, change: -6 },
          { id: 'c', label: 'NAVER', value: 50, change: 0 },
        ],
      }),
    );
    expect((html.match(/<rect/g) ?? []).length).toBe(3);
    expect(html).toContain('삼성전자');
    expect(html).toContain('+2.50%');
    expect(html).toContain('#3182f6'); // full down color at |change| >= maxChange
    expect(html).toContain('#8B95A1'); // flat
  });
  it('draws a wick and body per candle plus volume bars', () => {
    const data = [
      { open: 100, high: 110, low: 95, close: 108, volume: 1000 },
      { open: 108, high: 112, low: 101, close: 102, volume: 1500 },
      null,
    ];
    const html = render(h(CandlestickChart, { data, width: 300, height: 200 }));
    expect((html.match(/<line/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('#F04452');
    expect(html).toContain('#3182F6');
    expect((html.match(/<path/g) ?? []).length).toBe(2); // volume bars
  });
});
