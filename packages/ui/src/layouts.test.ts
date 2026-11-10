import { describe, expect, it } from 'vitest';
import { isLayoutId, LAYOUT_GROUPS, LAYOUTS, layoutRects, MAX_PANES, paneCount, resizePair, sizesFor } from './layouts';

describe('split layouts', () => {
  it('pane counts match the menu group and use each index once', () => {
    for (const group of LAYOUT_GROUPS) {
      for (const id of group) {
        const n = paneCount(LAYOUTS[id]);
        expect(n).toBe(Number(id.split('-')[0]));
        expect(n).toBeLessThanOrEqual(MAX_PANES);
        const leaves: number[] = [];
        const walk = (node: (typeof LAYOUTS)[typeof id]): void => {
          if (typeof node === 'number') leaves.push(node);
          else node.children.forEach(walk);
        };
        walk(LAYOUTS[id]);
        expect(leaves).toEqual([...Array(n).keys()]);
      }
    }
  });

  it('menu covers every layout exactly once', () => {
    expect(LAYOUT_GROUPS.flat().sort()).toEqual(Object.keys(LAYOUTS).sort());
    expect(isLayoutId('4-grid')).toBe(true);
    expect(isLayoutId('5-grid')).toBe(false);
    expect(isLayoutId(undefined)).toBe(false);
  });

  it('sizesFor falls back to equal weights on missing or bad data', () => {
    expect(sizesFor({}, 'x', 3)).toEqual([1, 1, 1]);
    expect(sizesFor({ x: [2, 1] }, 'x', 3)).toEqual([1, 1, 1]);
    expect(sizesFor({ x: [2, -1, 1] }, 'x', 3)).toEqual([1, 1, 1]);
    expect(sizesFor({ x: [2, 1, 1] }, 'x', 3)).toEqual([2, 1, 1]);
  });

  it('resizePair moves one boundary, keeps the total and a minimum share', () => {
    const next = resizePair([1, 1, 1], 0, 0.1);
    expect(next[0]).toBeCloseTo(1.3);
    expect(next[1]).toBeCloseTo(0.7);
    expect(next[2]).toBe(1);
    const squeezed = resizePair([1, 1], 0, 5);
    expect(squeezed[0]! + squeezed[1]!).toBeCloseTo(2);
    expect(squeezed[1]).toBeCloseTo(2 * 0.12);
  });

  it('layoutRects tiles the preview box', () => {
    const rects = layoutRects(LAYOUTS['4-grid'], 0, 0, 20, 16, 0);
    expect(rects).toHaveLength(4);
    expect(rects.reduce((a, r) => a + r.w * r.h, 0)).toBeCloseTo(320);
  });
});
