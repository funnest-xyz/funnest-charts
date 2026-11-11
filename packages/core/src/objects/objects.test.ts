import { describe, expect, it, vi } from 'vitest';
import { DrawingManager, drawingRegistry, type DrawingDefinition } from './drawings';
import { TradingLayer } from './trading';
import type { PaneCoords } from './types';

/** 1 bar = 10px = 1000ms, price = 1000 - y. */
const coords: PaneCoords = {
  plotWidth: 1000,
  height: 1000,
  timeToX: (t) => t / 100,
  timeToIndex: (t) => t / 1000,
  pointAt: (x, y) => ({ time: Math.round(x / 10) * 1000, price: 1000 - y }),
  priceToY: (p) => 1000 - p,
  yToPrice: (y) => 1000 - y,
  snapPrice: (p) => Math.round(p),
  formatPrice: (p) => String(p),
};

describe('DrawingManager', () => {
  it('creates a trendline with click-click and disarms the tool', () => {
    const changes: string[] = [];
    const m = new DrawingManager((c) => changes.push(c));
    m.setTool('trendline');
    m.createAt(coords, 100, 500);
    m.previewAt(coords, 200, 400);
    expect(m.drawings).toHaveLength(0);
    m.createAt(coords, 300, 300);
    expect(m.drawings).toHaveLength(1);
    expect(m.drawings[0]!.points).toEqual([
      { time: 10_000, price: 500 },
      { time: 30_000, price: 700 },
    ]);
    expect(m.tool).toBeNull();
    expect(m.selectedId).toBe(m.drawings[0]!.id);
    expect(changes).toContain('commit');
  });

  it('creates with drag-to-draw and a single click for horizontal lines', () => {
    const m = new DrawingManager(() => {});
    m.setTool('fibonacci');
    m.createAt(coords, 100, 500);
    m.previewAt(coords, 150, 450);
    m.releaseAt(coords, 200, 400, true);
    expect(m.drawings[0]!.points[1]).toEqual({ time: 20_000, price: 600 });

    m.setTool('horizontal');
    m.createAt(coords, 500, 250);
    expect(m.drawings).toHaveLength(2);
    expect(m.drawings[1]!.points).toEqual([{ time: 50_000, price: 750 }]);
  });

  it('hit-tests and drags handles and bodies', () => {
    const m = new DrawingManager(() => {});
    m.setTool('trendline');
    m.createAt(coords, 100, 500);
    m.createAt(coords, 300, 500);
    const id = m.drawings[0]!.id;

    expect(m.hitTest(coords, 200, 503, 5)).toEqual({ kind: 'drawing', id, part: 'body' });
    expect(m.hitTest(coords, 200, 520, 5)).toBeNull();
    expect(m.hitTest(coords, 301, 499, 5)).toEqual({ kind: 'drawing', id, part: 1 });

    m.beginDrag(coords, id, 'body', 200, 500);
    m.dragTo(coords, 250, 450);
    m.endDrag(true);
    expect(m.drawings[0]!.points).toEqual([
      { time: 15_000, price: 550 },
      { time: 35_000, price: 550 },
    ]);
  });

  it('Esc cancels a draft, then deselects', () => {
    const m = new DrawingManager(() => {});
    m.setTool('trendline');
    m.createAt(coords, 100, 500);
    m.cancel();
    expect(m.tool).toBeNull();
    m.createAt(coords, 100, 500); // no tool: ignored
    expect(m.drawings).toHaveLength(0);
  });
});

describe('TradingLayer orders', () => {
  it('moves an order on drag and reverts when onMove returns false', async () => {
    const layer = new TradingLayer(() => {});
    const onMove = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(undefined);
    const handle = layer.addOrder({ price: 100, quantity: 1, side: 'buy', onMove });

    expect(layer.hitTest((p) => 1000 - p, 500, 902, 5)).toEqual({ kind: 'order', id: handle.id, part: 'line' });

    layer.beginDrag(handle.id);
    layer.dragTo(120);
    layer.endDrag();
    expect(onMove).toHaveBeenCalledWith(120);
    await Promise.resolve();
    await Promise.resolve();
    expect(layer.hitTest((p) => 1000 - p, 500, 900, 2)?.kind).toBe('order'); // reverted to 100

    layer.beginDrag(handle.id);
    layer.dragTo(130);
    layer.endDrag();
    await Promise.resolve();
    await Promise.resolve();
    expect(layer.hitTest((p) => 1000 - p, 500, 870, 2)?.kind).toBe('order'); // kept at 130
  });

  it('is not draggable without onMove', () => {
    const layer = new TradingLayer(() => {});
    layer.addOrder({ price: 100, quantity: 1, side: 'sell' });
    expect(layer.hitTest((p) => 1000 - p, 500, 900, 5)).toBeNull();
  });
});

describe('snapToOhlc', () => {
  it('picks the OHLC value nearest to the pointer', async () => {
    const { snapToOhlc } = await import('./magnet');
    const bar = { time: 0, open: 100, high: 120, low: 90, close: 110 };
    const priceToY = (p: number) => 1000 - p * 5; // 120 → 400, 110 → 450, 100 → 500, 90 → 550
    expect(snapToOhlc(bar, 390, priceToY)).toBe(120);
    expect(snapToOhlc(bar, 460, priceToY)).toBe(110);
    expect(snapToOhlc(bar, 540, priceToY)).toBe(90);
  });
});

describe('custom drawing definitions', () => {
  /** One click → entry, target 10 above, stop 5 below, 3 bars wide; target/stop share their time. */
  const position: DrawingDefinition = {
    type: 'position',
    name: { ko: '포지션', en: 'Position' },
    clicks: 1,
    create: ([p]) => [p!, { time: p!.time + 3000, price: p!.price + 10 }, { time: p!.time + 3000, price: p!.price - 5 }],
    constrain: (pts, i) => (i === 0 ? pts : pts.map((p, j) => (j === 0 ? p : { ...p, time: pts[i]!.time }))),
    distance: (g, x, y) => Math.abs(y - g.points[0]![1]),
    render: () => {},
  };

  it('expands clicks with create() and keeps points consistent with constrain()', () => {
    const m = new DrawingManager(() => {}, drawingRegistry([position]));
    m.setTool('position');
    m.createAt(coords, 100, 500);
    const d = m.drawings[0]!;
    expect(d.points).toEqual([
      { time: 10_000, price: 500 },
      { time: 13_000, price: 510 },
      { time: 13_000, price: 495 },
    ]);
    // Drag the stop handle (index 2) right: the target follows in time.
    m.beginDrag(coords, d.id, 2, 130, 505);
    m.dragTo(coords, 200, 505);
    m.endDrag(true);
    expect(m.drawings[0]!.points[1]!.time).toBe(20_000);
  });

  it('rejects unknown tools and keeps unknown saved drawings without drawing them', () => {
    const m = new DrawingManager(() => {});
    expect(() => m.setTool('position')).toThrow();
    m.set([{ id: 'x', type: 'position', points: [{ time: 0, price: 1 }] }]);
    expect(m.drawings).toHaveLength(1);
    expect(m.hitTest(coords, 0, 999, 5)).toBeNull();
  });
});

describe('TradingLayer alerts', () => {
  it('drags alert lines like orders', () => {
    const layer = new TradingLayer(() => {});
    const onMove = vi.fn();
    const handle = layer.addAlert({ price: 100, onMove });
    expect(layer.hitTest((p) => 1000 - p, 500, 900, 5)).toEqual({ kind: 'order', id: handle.id, part: 'line' });
    layer.beginDrag(handle.id);
    layer.dragTo(110);
    layer.endDrag();
    expect(onMove).toHaveBeenCalledWith(110);
  });
});
