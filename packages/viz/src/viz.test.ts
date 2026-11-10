import { describe, expect, it } from 'vitest';
import {
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
    expect(barPath(0, 10, 50, 80, 2)).toContain('Q0,80 2,80');
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
