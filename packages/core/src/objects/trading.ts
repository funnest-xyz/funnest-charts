import type { Bar } from '../types';
import { inRect, type PillSegment, type Rect } from '../render/painter';
import { newId, type AxisBadge, type ObjectHit, type ObjectRenderContext } from './types';

export interface PositionLineOptions {
  /** Average entry price. */
  price: number;
  quantity: number;
  side: 'long' | 'short';
  /** Overrides the default "평균단가" / "Avg" text. */
  label?: string;
}

export interface OrderLineOptions {
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  /** Extra text such as "지정가" or "STOP". */
  label?: string;
  /**
   * Called when the user drags the line to a new (tick-snapped) price. The line moves
   * immediately; return `false` (or reject) to snap it back, e.g. when the broker refuses.
   */
  onMove?: (price: number) => void | boolean | Promise<void | boolean>;
  /** Shows an × button on the label. */
  onCancel?: () => void;
}

export interface ExecutionMarker {
  time: number;
  price: number;
  side: 'buy' | 'sell';
  quantity?: number;
}

/** Fills on the same bar and side, shown as one marker. */
export interface ExecutionGroup {
  key: string;
  side: 'buy' | 'sell';
  count: number;
  quantity: number;
  /** Quantity-weighted average price (plain average when quantities are missing). */
  averagePrice: number;
  /** Earliest fill time in the group. */
  time: number;
  x: number;
  y: number;
}

export interface LineHandle<T> {
  readonly id: string;
  update(patch: Partial<T>): void;
  remove(): void;
}

export interface TradingLabels {
  buy: string;
  sell: string;
  position: string;
}

const LABEL_X = 12;
const LABEL_HEIGHT = 20;
const ORDER_DASH: readonly [number, number] = [6, 4];

/** Position (average price) lines, draggable order lines and execution markers. */
export class TradingLayer {
  private readonly positions = new Map<string, PositionLineOptions>();
  private readonly orders = new Map<string, OrderLineOptions>();
  private executions: ExecutionMarker[] = [];
  private labelRects = new Map<string, { label: Rect; cancel: Rect | null }>();
  private drag: { id: string; price: number } | null = null;
  private groups: ExecutionGroup[] = [];

  constructor(private readonly onChange: () => void) {}

  addPosition(options: PositionLineOptions): LineHandle<PositionLineOptions> {
    const id = newId('pos');
    this.positions.set(id, { ...options });
    this.onChange();
    return this.handle(id, this.positions);
  }

  addOrder(options: OrderLineOptions): LineHandle<OrderLineOptions> {
    const id = newId('ord');
    this.orders.set(id, { ...options });
    this.onChange();
    return this.handle(id, this.orders);
  }

  setExecutions(markers: readonly ExecutionMarker[]): void {
    this.executions = markers.slice();
    this.onChange();
  }

  private handle<T extends object>(id: string, map: Map<string, T>): LineHandle<T> {
    return {
      id,
      update: (patch) => {
        const current = map.get(id);
        if (!current) return;
        map.set(id, { ...current, ...patch });
        this.onChange();
      },
      remove: () => {
        if (map.delete(id)) this.onChange();
      },
    };
  }

  get executionList(): readonly ExecutionMarker[] {
    return this.executions;
  }

  executionGroup(key: string): ExecutionGroup | undefined {
    return this.groups.find((g) => g.key === key);
  }

  // ── Interaction ───────────────────────────────────────────────────

  hitTest(priceToY: (p: number) => number, x: number, y: number, tolerance: number): ObjectHit | null {
    for (const g of this.groups) {
      if (Math.abs(g.x - x) <= 6 + tolerance / 2 && Math.abs(g.y - y) <= 6 + tolerance / 2) return { kind: 'execution', key: g.key };
    }
    for (const [id, order] of this.orders) {
      const rects = this.labelRects.get(id);
      if (rects?.cancel && inRect(rects.cancel, x, y, tolerance / 2)) return { kind: 'order', id, part: 'cancel' };
      if (!order.onMove) continue;
      const lineY = priceToY(this.drag?.id === id ? this.drag.price : order.price);
      if ((rects && inRect(rects.label, x, y, tolerance / 2)) || Math.abs(y - lineY) <= tolerance) {
        return { kind: 'order', id, part: 'line' };
      }
    }
    return null;
  }

  beginDrag(id: string): void {
    const order = this.orders.get(id);
    if (order?.onMove) this.drag = { id, price: order.price };
  }

  dragTo(price: number): void {
    if (!this.drag) return;
    this.drag.price = price;
    this.onChange();
  }

  endDrag(): void {
    const drag = this.drag;
    this.drag = null;
    const order = drag && this.orders.get(drag.id);
    if (!drag || !order || drag.price === order.price) {
      this.onChange();
      return;
    }
    const previous = order.price;
    order.price = drag.price;
    this.onChange();
    const revert = () => {
      const current = this.orders.get(drag.id);
      if (current && current.price === drag.price) {
        current.price = previous;
        this.onChange();
      }
    };
    try {
      Promise.resolve(order.onMove?.(drag.price)).then((ok) => ok === false && revert(), revert);
    } catch {
      revert();
    }
  }

  cancel(id: string): void {
    this.orders.get(id)?.onCancel?.();
  }

  // ── Rendering ─────────────────────────────────────────────────────

  render(
    { painter: p, coords: c, palette }: ObjectRenderContext,
    bars: readonly Bar[],
    barIndexAt: (time: number) => number,
    indexToX: (index: number) => number,
    labels: TradingLabels,
    badges: AxisBadge[],
  ): void {
    this.labelRects.clear();
    const last = bars[bars.length - 1];
    const visible = (y: number) => y >= 0 && y <= c.height;

    // Executions: one marker per bar and side — ▲ under the bar for buys, ▼ above for sells.
    const byKey = new Map<string, ExecutionGroup & { weighted: number; weight: number }>();
    for (const e of this.executions) {
      const index = barIndexAt(e.time);
      const bar = bars[index];
      if (!bar) continue;
      const key = `${bar.time}:${e.side}`;
      let g = byKey.get(key);
      if (!g) {
        const buy = e.side === 'buy';
        g = {
          key,
          side: e.side,
          count: 0,
          quantity: 0,
          averagePrice: 0,
          time: e.time,
          x: indexToX(index),
          y: buy ? c.priceToY(bar.low) + 10 : c.priceToY(bar.high) - 10,
          weighted: 0,
          weight: 0,
        };
        byKey.set(key, g);
      }
      const q = e.quantity ?? 1;
      g.count++;
      g.quantity += e.quantity ?? 0;
      g.weighted += e.price * q;
      g.weight += q;
      g.time = Math.min(g.time, e.time);
    }
    this.groups = [...byKey.values()].map(({ weighted, weight, ...g }) => ({ ...g, averagePrice: weighted / weight }));
    const { ctx } = p;
    for (const g of this.groups) {
      if (g.x < -10 || g.x > c.plotWidth + 10) continue;
      const buy = g.side === 'buy';
      ctx.beginPath();
      ctx.moveTo(g.x, buy ? g.y - 5 : g.y + 5);
      ctx.lineTo(g.x - 5, buy ? g.y + 4 : g.y - 4);
      ctx.lineTo(g.x + 5, buy ? g.y + 4 : g.y - 4);
      ctx.closePath();
      ctx.fillStyle = buy ? palette.up : palette.down;
      ctx.fill();
      if (g.count > 1) p.text(String(g.count), g.x + 7, g.y, buy ? palette.up : palette.down, 'left', 'middle');
    }

    for (const pos of this.positions.values()) {
      const y = c.priceToY(pos.price);
      badges.push({ y, text: c.formatPrice(pos.price), bg: palette.text, fg: palette.background });
      if (!visible(y)) continue;
      p.hLine(y, 0, c.plotWidth, palette.text);
      const segments = [
        { text: `${pos.label ?? labels.position} · ${pos.quantity}`, bg: palette.text, fg: palette.background },
      ];
      if (last) {
        const pnl = (last.close - pos.price) * pos.quantity * (pos.side === 'long' ? 1 : -1);
        const pct = pos.price ? ((last.close - pos.price) / pos.price) * 100 * (pos.side === 'long' ? 1 : -1) : 0;
        const sign = pnl > 0 ? '+' : '';
        segments.push({
          text: `${sign}${c.formatPrice(pnl)} (${sign}${pct.toFixed(2)}%)`,
          bg: pnl >= 0 ? palette.up : palette.down,
          fg: '#FFFFFF',
        });
      }
      p.pill(segments, LABEL_X, y, LABEL_HEIGHT);
    }

    for (const [id, order] of this.orders) {
      const price = this.drag?.id === id ? this.drag.price : order.price;
      const y = c.priceToY(price);
      const color = order.side === 'buy' ? palette.up : palette.down;
      badges.push({ y, text: c.formatPrice(price), bg: color, fg: '#FFFFFF' });
      if (!visible(y)) continue;
      p.hLine(y, 0, c.plotWidth, color, ORDER_DASH);
      const side = order.side === 'buy' ? labels.buy : labels.sell;
      const main = [side, order.label, String(order.quantity)].filter(Boolean).join(' ');
      const segments: PillSegment[] = [{ text: main, bg: color, fg: '#FFFFFF' }];
      if (order.onCancel) segments.push({ text: '×', bg: color, fg: '#FFFFFF', padding: 7 });
      const rects = p.pill(segments, LABEL_X, y, LABEL_HEIGHT);
      if (order.onCancel && rects[1]) p.vLine(rects[1].x, y - 6, y + 6, 'rgba(255,255,255,0.4)');
      this.labelRects.set(id, {
        label: { x: rects[0]!.x, y: rects[0]!.y, w: rects.reduce((w, r) => w + r.w, 0), h: LABEL_HEIGHT },
        cancel: order.onCancel ? rects[1]! : null,
      });
    }
  }
}
