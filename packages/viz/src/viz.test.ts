import { describe, expect, it } from 'vitest';
import {
  logScale,
  logTicks,
  areaPath,
  bandScale,
  barPath,
  linearScale,
  linePath,
  nearestIndex,
  niceDomain,
  percentages,
  segments,
  seriesChange,
  stack,
  stackedExtent,
  ticks,
} from './index';

describe('scales', () => {
  it('linear maps and inverts (y axis flipped)', () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(25)).toBe(150);
    expect(y.invert(150)).toBe(25);
  });
  it('flat domain sits in the middle', () => {
    expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
  });
  it('band scale', () => {
    const x = bandScale(4, [0, 400], 0.2);
    expect(x.step).toBe(100);
    expect(x.bandwidth).toBe(80);
    expect(x(1)).toBe(110);
    expect(x.center(1)).toBe(150);
    expect(x.invert(399)).toBe(3);
    expect(x.invert(-5)).toBe(0);
  });
});

describe('ticks', () => {
  it('nice ticks', () => {
    expect(ticks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(ticks(0.1, 0.35, 5)).toEqual([0.1, 0.15, 0.2, 0.25, 0.3, 0.35]);
    expect(ticks(3, 3)).toEqual([3]);
  });
  it('nice domain', () => {
    expect(niceDomain(3, 97, 5)).toEqual([0, 100]);
    expect(niceDomain(5, 5)).toEqual([4.5, 5.5]);
  });
});

describe('paths', () => {
  const pts = [
    { x: 0, y: 10 },
    { x: 10, y: 0 },
    { x: 20, y: 5 },
  ];
  it('linear', () => expect(linePath(pts)).toBe('M0,10L10,0L20,5'));
  it('step', () => expect(linePath(pts, 'stepAfter')).toBe('M0,10H10V0H20V5'));
  it('monotone never overshoots the local extremum', () => {
    const d = linePath(pts, 'monotone');
    expect(d.startsWith('M0,10C')).toBe(true);
    // Tangent at the peak (index 1) is flat, so both control points around it share y=0.
    expect(d).toContain(' 6.67,0 10,0C13.33,0');
  });
  it('area closes to a baseline', () => {
    expect(areaPath(pts, 30)).toBe('M0,10L10,0L20,5L20,30L0,30Z');
  });
  it('splits gaps', () => {
    expect(segments([1, 2, null, 4])).toEqual([
      { start: 0, values: [1, 2] },
      { start: 3, values: [4] },
    ]);
  });
  it('bars', () => {
    expect(barPath(0, 10, 100, 40)).toBe('M0,40H10V100H0Z');
    // Negative bar (below the baseline) rounds its bottom corners.
    // Negative bar (below the baseline): bottom corners rounded, top (baseline) square.
    const neg = barPath(0, 10, 50, 80, 2);
    expect(neg).toContain('Q10,80 8,80');
    expect(neg.startsWith('M0,50H10')).toBe(true);
  });
});

describe('data', () => {
  it('stacks positive up and negative down', () => {
    const s = stack([
      { id: 'a', data: [1, -2] },
      { id: 'b', data: [2, -1] },
    ]);
    expect(s[1]).toEqual({ id: 'b', y0: [1, -2], y1: [3, -3] });
    expect(stackedExtent(s)).toEqual([-3, 3]);
  });
  it('percentages', () => {
    const p = percentages([
      { id: 'a', value: 30 },
      { id: 'b', value: 70 },
      { id: 'c', value: -5 },
    ]);
    expect(p.map((x) => x.fraction)).toEqual([0.3, 0.7, 0]);
    expect(p[1]!.start).toBe(0.3);
  });
  it('nearest index', () => {
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2);
    expect(nearestIndex([0, 10, 20, 30], 99)).toBe(3);
  });
  it('series change skips gaps', () => {
    expect(seriesChange([null, 100, 110, null])).toEqual({ first: 100, last: 110, change: 10, percent: 10 });
  });
});

describe('log scale', () => {
  it('maps decades evenly', () => {
    const y = logScale([1, 1000], [300, 0]);
    expect(y(1)).toBe(300);
    expect(y(10)).toBe(200);
    expect(y(1000)).toBe(0);
    expect(Math.round(y.invert(100))).toBe(100);
  });
  it('ticks at 1, 2, 5 × 10ⁿ', () => {
    expect(logTicks(1, 1000, 5)).toEqual([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]);
    expect(logTicks(1, 1e8, 3)).toEqual([1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000]);
  });
});

describe('bar path ends', () => {
  it('rounds both ends with roundBase', () => {
    const d = barPath(0, 10, 100, 40, 4, true);
    expect(d.match(/Q/g)?.length).toBe(4);
    expect(barPath(0, 10, 100, 40, 4).match(/Q/g)?.length).toBe(2);
  });
});

import { arcPath, arcs, treemap } from './shapes';

describe('shapes', () => {
  it('splits a circle by value and pads between segments', () => {
    const a = arcs([{ id: 'a', value: 3 }, { id: 'b', value: 1 }, { id: 'c', value: -2 }]);
    expect(a.map((s) => s.fraction)).toEqual([0.75, 0.25, 0]);
    expect(a[1]!.endAngle).toBeCloseTo(Math.PI * 2);
    const p = arcs([{ id: 'a', value: 1 }, { id: 'b', value: 1 }], 0.1);
    expect(p[0]!.endAngle - p[0]!.startAngle).toBeCloseTo(Math.PI - 0.1);
  });
  it('draws ring, pie, rounded and full-circle paths', () => {
    expect(arcPath(50, 50, 30, 40, 0, Math.PI / 2)).toMatch(/^M50,10A40,40 0 0 1 90,50L80,50A30,30 0 0 0 50,20Z$/);
    expect(arcPath(50, 50, 0, 40, 0, Math.PI / 2)).toContain('L50,50Z');
    expect(arcPath(50, 50, 30, 40, 0, 1, 3).match(/A/g)!.length).toBe(6);
    expect(arcPath(50, 50, 30, 40, 0, Math.PI * 2).match(/Z/g)!.length).toBe(2);
  });
  it('lays out a squarified treemap that fills the area', () => {
    const r = treemap([{ id: 'a', value: 6 }, { id: 'b', value: 6 }, { id: 'c', value: 4 }, { id: 'd', value: 3 }, { id: 'e', value: 2 }, { id: 'z', value: 0 }], 600, 400);
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    const area = r.reduce((t, x) => t + x.width * x.height, 0);
    expect(area).toBeCloseTo(240000);
    for (const x of r) expect(Math.max(x.width / x.height, x.height / x.width)).toBeLessThan(3);
    const g = treemap([{ id: 'a', value: 1 }, { id: 'b', value: 1 }], 100, 50, 4);
    expect(g[0]!.width + g[1]!.width).toBeCloseTo(96);
  });
});
