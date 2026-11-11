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

/** A price alert shown as a dotted line with a bell label. The alert logic itself is yours. */
export interface AlertLineOptions {
  price: number;
  /** Overrides the default "알림" / "Alert" text. */
  label?: string;
  /** Called when the user drags the line; same contract as OrderLineOptions.onMove. */
  onMove?: (price: number) => void | boolean | Promise<void | boolean>;
  /** Shows an × button on the label. */
  onCancel?: () => void;
}

export interface ExecutionMarker {
  time: number;
  price: number;
  side: 'buy' | 'sell';
  quantity?: number;
  /** 'liquidation': a forced close, drawn as a ⚡ badge at its price instead of ▲/▼. Default 'fill'. */
  kind?: 'fill' | 'liquidation';
}

/**
 * What the labels of position, order and alert lines show, and where (chart settings like
 * "라벨" in trading terminals). Defaults keep the original look.
 */
export interface TradingLabelOptions {
  /** 매수/매도 and the position name. */
  side: boolean;
  /** The line's price inside the label (the price axis always shows it). */
  price: boolean;
  quantity: boolean;
  /** Positions: P&L against the last price. */
  pnl: boolean;
  /** The × on cancellable lines. */
  buttons: boolean;
  align: 'left' | 'center' | 'right';
  /** Draw lines across the whole chart; off, only from the label to the price axis. */
  fullWidth: boolean;
}

export const DEFAULT_TRADING_LABEL_OPTIONS: TradingLabelOptions = {
  side: true,
  price: false,
  quantity: true,
  pnl: true,
  buttons: true,
  align: 'left',
  fullWidth: true,
};

/** Fills on the same bar and side, shown as one marker. */
export interface ExecutionGroup {
  key: string;
  side: 'buy' | 'sell';
  kind: 'fill' | 'liquidation';
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
  alert: string;
}

type LineEntry = OrderLineOptions & { alert?: boolean };

const LABEL_X = 12;
const LABEL_HEIGHT = 20;
const LABEL_GAP = 6;
const ORDER_DASH: readonly [number, number] = [6, 4];
const ALERT_DASH: readonly [number, number] = [2, 3];

/** Position (average price) lines, draggable order lines and execution markers. */
export class TradingLayer {
  private readonly positions = new Map<string, PositionLineOptions>();
  /** Order lines and alert lines (same dragging and × behavior). */
  private readonly orders = new Map<string, LineEntry>();
  private executions: ExecutionMarker[] = [];
  private labelRects = new Map<string, { label: Rect; cancel: Rect | null }>();
  private drag: { id: string; price: number } | null = null;
  private groups: ExecutionGroup[] = [];
  private labelOptions: TradingLabelOptions = { ...DEFAULT_TRADING_LABEL_OPTIONS };

  constructor(private readonly onChange: () => void) {}

  get labelSettings(): TradingLabelOptions {
    return { ...this.labelOptions };
  }

  setLabelOptions(patch: Partial<TradingLabelOptions>): void {
    this.labelOptions = { ...this.labelOptions, ...patch };
    this.onChange();
  }

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

  addAlert(options: AlertLineOptions): LineHandle<AlertLineOptions> {
    const id = newId('alert');
    this.orders.set(id, { ...options, quantity: 0, side: 'buy', alert: true });
    this.onChange();
    return this.handle(id, this.orders) as LineHandle<AlertLineOptions>;
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
      const liquidation = e.kind === 'liquidation';
      const key = `${bar.time}:${liquidation ? 'liq' : e.side}`;
      let g = byKey.get(key);
      if (!g) {
        const buy = e.side === 'buy';
        g = {
          key,
          side: e.side,
          kind: liquidation ? 'liquidation' : 'fill',
          count: 0,
          quantity: 0,
          averagePrice: 0,
          time: e.time,
          x: indexToX(index),
          y: liquidation ? c.priceToY(e.price) : buy ? c.priceToY(bar.low) + 10 : c.priceToY(bar.high) - 10,
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
      if (g.kind === 'liquidation') {
        // ⚡ in a red badge at the liquidation price.
        ctx.beginPath();
        ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = palette.down;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(g.x + 1.5, g.y - 5.5);
        ctx.lineTo(g.x - 3.5, g.y + 1);
        ctx.lineTo(g.x - 0.2, g.y + 1);
        ctx.lineTo(g.x - 1.5, g.y + 5.5);
        ctx.lineTo(g.x + 3.5, g.y - 1);
        ctx.lineTo(g.x + 0.2, g.y - 1);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        continue;
      }
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

    // Labels sit at the chosen side (left, centre, right). Labels of lines at nearly the same
    // price would cover each other: each one moves past the ones it would overlap — rightwards,
    // or leftwards when aligned right. Clicks follow the label.
    const opts = this.labelOptions;
    const placed: Rect[] = [];
    const placeX = (width: number, y: number) => {
      const toLeft = opts.align === 'right';
      let x = opts.align === 'left' ? LABEL_X : toLeft ? c.plotWidth - width - LABEL_X : (c.plotWidth - width) / 2;
      for (let moved = true; moved; ) {
        moved = false;
        for (const r of placed) {
          const overlapsY = Math.abs(r.y + LABEL_HEIGHT / 2 - y) < LABEL_HEIGHT + 2;
          if (overlapsY && x < r.x + r.w + LABEL_GAP && x + width > r.x - LABEL_GAP) {
            x = toLeft ? r.x - width - LABEL_GAP : r.x + r.w + LABEL_GAP;
            moved = true;
          }
        }
      }
      placed.push({ x, y: y - LABEL_HEIGHT / 2, w: width, h: LABEL_HEIGHT });
      return x;
    };
    /** The line, then its label on top; without full width the line runs from the label to the axis. */
    const drawLine = (y: number, color: string, segments: PillSegment[], dash?: readonly [number, number]) => {
      if (segments.length === 0) {
        p.hLine(y, 0, c.plotWidth, color, dash);
        return null;
      }
      const x = placeX(p.pillWidth(segments), y);
      const from = opts.fullWidth ? 0 : Math.min(x + p.pillWidth(segments), c.plotWidth);
      p.hLine(y, from, c.plotWidth, color, dash);
      return p.pill(segments, x, y, LABEL_HEIGHT);
    };

    for (const pos of this.positions.values()) {
      const y = c.priceToY(pos.price);
      badges.push({ y, text: c.formatPrice(pos.price), bg: palette.text, fg: palette.background });
      if (!visible(y)) continue;
      const main = [opts.side ? (pos.label ?? labels.position) : '', opts.price ? c.formatPrice(pos.price) : '', opts.quantity ? String(pos.quantity) : '']
        .filter(Boolean)
        .join(' · ');
      const segments: PillSegment[] = main ? [{ text: main, bg: palette.text, fg: palette.background }] : [];
      if (last && opts.pnl) {
        const pnl = (last.close - pos.price) * pos.quantity * (pos.side === 'long' ? 1 : -1);
        const pct = pos.price ? ((last.close - pos.price) / pos.price) * 100 * (pos.side === 'long' ? 1 : -1) : 0;
        const sign = pnl > 0 ? '+' : '';
        segments.push({
          text: `${sign}${c.formatPrice(pnl)} (${sign}${pct.toFixed(2)}%)`,
          bg: pnl >= 0 ? palette.up : palette.down,
          fg: '#FFFFFF',
        });
      }
      drawLine(y, palette.text, segments);
    }

    for (const [id, order] of this.orders) {
      const price = this.drag?.id === id ? this.drag.price : order.price;
      const y = c.priceToY(price);
      const color = order.alert ? palette.textSecondary : order.side === 'buy' ? palette.up : palette.down;
      badges.push({ y, text: c.formatPrice(price), bg: color, fg: '#FFFFFF' });
      if (!visible(y)) continue;
      // The custom label (지정가, 익절, 알림…) always shows; direction, price and size follow the options.
      const main = (
        order.alert
          ? [order.label ?? labels.alert, opts.price ? c.formatPrice(price) : '']
          : [opts.side ? (order.side === 'buy' ? labels.buy : labels.sell) : '', order.label, opts.price ? c.formatPrice(price) : '', opts.quantity ? String(order.quantity) : '']
      )
        .filter(Boolean)
        .join(' ');
      const cancellable = !!order.onCancel && opts.buttons;
      const segments: PillSegment[] = [{ text: main || c.formatPrice(price), bg: color, fg: '#FFFFFF' }];
      if (cancellable) segments.push({ text: '×', bg: color, fg: '#FFFFFF', padding: 7 });
      const rects = drawLine(y, color, segments, order.alert ? ALERT_DASH : ORDER_DASH)!;
      if (cancellable && rects[1]) p.vLine(rects[1].x, y - 6, y + 6, 'rgba(255,255,255,0.4)');
      this.labelRects.set(id, {
        label: { x: rects[0]!.x, y: rects[0]!.y, w: rects.reduce((w, r) => w + r.w, 0), h: LABEL_HEIGHT },
        cancel: cancellable ? rects[1]! : null,
      });
    }
  }
}
