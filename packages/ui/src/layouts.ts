/**
 * Split layouts for the multi-chart widget, as trees: a leaf is a pane index, a split lays
 * its children out in a row (side by side) or a column (stacked). Pure data — rendering
 * lives in multi-chart.tsx.
 */
export type SplitNode = number | { dir: 'row' | 'col'; children: SplitNode[] };

export type LayoutId =
  | '1'
  | '2-cols'
  | '2-rows'
  | '3-cols'
  | '3-rows'
  | '3-left'
  | '3-top'
  | '4-grid'
  | '4-cols'
  | '4-left'
  | '6-grid'
  | '8-grid';

const row = (...children: SplitNode[]): SplitNode => ({ dir: 'row', children });
const col = (...children: SplitNode[]): SplitNode => ({ dir: 'col', children });

export const LAYOUTS: Record<LayoutId, SplitNode> = {
  '1': 0,
  '2-cols': row(0, 1),
  '2-rows': col(0, 1),
  '3-cols': row(0, 1, 2),
  '3-rows': col(0, 1, 2),
  '3-left': row(0, col(1, 2)),
  '3-top': col(0, row(1, 2)),
  '4-grid': col(row(0, 1), row(2, 3)),
  '4-cols': row(0, 1, 2, 3),
  '4-left': row(0, col(1, 2, 3)),
  '6-grid': col(row(0, 1, 2), row(3, 4, 5)),
  '8-grid': col(row(0, 1, 2, 3), row(4, 5, 6, 7)),
};

/** Menu order, grouped by pane count. */
export const LAYOUT_GROUPS: readonly (readonly LayoutId[])[] = [
  ['1'],
  ['2-cols', '2-rows'],
  ['3-cols', '3-rows', '3-left', '3-top'],
  ['4-grid', '4-cols', '4-left'],
  ['6-grid', '8-grid'],
];

export const MAX_PANES = 8;

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && value in LAYOUTS;
}

export function paneCount(node: SplitNode): number {
  if (typeof node === 'number') return 1;
  let n = 0;
  for (const child of node.children) n += paneCount(child);
  return n;
}

/**
 * Flex weights per split, keyed by `layoutId:path` (path = child indices from the root, e.g.
 * '4-grid:1' is the bottom row of the 2×2 grid). Missing entries mean equal sizes.
 */
export type SplitSizes = Record<string, number[]>;

export function sizesFor(sizes: SplitSizes, key: string, count: number): number[] {
  const s = sizes[key];
  return s && s.length === count && s.every((v) => Number.isFinite(v) && v > 0) ? s : Array<number>(count).fill(1);
}

/**
 * Moves the boundary between children `i` and `i + 1` by `deltaFraction` of the split's
 * length. Neither side shrinks below `min` of the pair's total.
 */
export function resizePair(weights: readonly number[], i: number, deltaFraction: number, min = 0.12): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const a = weights[i]!;
  const b = weights[i + 1]!;
  const pair = a + b;
  const delta = deltaFraction * total;
  const nextA = Math.min(pair * (1 - min), Math.max(pair * min, a + delta));
  const next = [...weights];
  next[i] = nextA;
  next[i + 1] = pair - nextA;
  return next;
}

/** Small SVG preview of a layout for menus (rects in a 20×16 box). */
export function layoutRects(node: SplitNode, x = 0, y = 0, w = 20, h = 16, gap = 1.6): { x: number; y: number; w: number; h: number }[] {
  if (typeof node === 'number') return [{ x, y, w, h }];
  const n = node.children.length;
  const out: { x: number; y: number; w: number; h: number }[] = [];
  node.children.forEach((child, i) => {
    if (node.dir === 'row') {
      const cw = (w - gap * (n - 1)) / n;
      out.push(...layoutRects(child, x + i * (cw + gap), y, cw, h, gap));
    } else {
      const ch = (h - gap * (n - 1)) / n;
      out.push(...layoutRects(child, x, y + i * (ch + gap), w, ch, gap));
    }
  });
  return out;
}
