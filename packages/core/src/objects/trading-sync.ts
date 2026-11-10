import type { SymbolInfo, Unsubscribe } from '../types';
import type { ExecutionMarker, LineHandle, OrderLineOptions, PositionLineOptions, TradingLayer } from './trading';

export interface PositionInfo {
  price: number;
  quantity: number;
  side: 'long' | 'short';
  label?: string;
}

export interface OrderInfo {
  id: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  /** e.g. "지정가", "STOP". */
  label?: string;
}

export interface Execution extends ExecutionMarker {
  /** Used to de-duplicate fills that arrive both from history and the live stream. */
  id?: string;
}

export interface TradingCallbacks {
  onExecution(execution: Execution): void;
  onPositions(positions: PositionInfo[]): void;
  onOrders(orders: OrderInfo[]): void;
}

/**
 * The user's account data for the chart. Implement this once against your own backend
 * (auth, broker API…); the chart handles loading per symbol, paging fills as history
 * scrolls in, live updates and all the drawing/interaction.
 */
export interface TradingAdapter {
  /** Fills within [from, to] (UTC ms). Called when a symbol loads and as older history pages in. */
  getExecutions?(symbol: SymbolInfo, range: { from: number; to: number }): Promise<Execution[]>;
  /** Open position(s) → average-price lines with live P&L. */
  getPositions?(symbol: SymbolInfo): Promise<PositionInfo[]>;
  /** Working orders → order lines. */
  getOrders?(symbol: SymbolInfo): Promise<OrderInfo[]>;
  /** Live account updates. Pass full position/order lists; fills one at a time. */
  subscribe?(symbol: SymbolInfo, callbacks: TradingCallbacks): Unsubscribe;
  /** Makes order lines draggable. Resolve `false` (or reject) to snap the line back. */
  modifyOrder?(order: OrderInfo, price: number): void | boolean | Promise<void | boolean>;
  /** Shows an × on order lines. Without `subscribe`, the line is removed once this resolves. */
  cancelOrder?(order: OrderInfo): void | Promise<void>;
}

const executionKey = (e: Execution) => e.id ?? `${e.time}|${e.side}|${e.price}|${e.quantity ?? ''}`;

/** Mirrors a TradingAdapter's state for the current symbol into the TradingLayer. */
export class TradingSync {
  adapter: TradingAdapter | null = null;
  private token = 0;
  private symbol: SymbolInfo | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private positions: LineHandle<PositionLineOptions>[] = [];
  private readonly orders = new Map<string, { info: OrderInfo; handle: LineHandle<OrderLineOptions> }>();
  private readonly executions = new Map<string, Execution>();
  private loadedFrom = Infinity;

  constructor(
    private readonly layer: TradingLayer,
    private readonly onError: (error: unknown) => void,
  ) {}

  /** (Re)loads everything for a symbol whose bars start at `from`. */
  async load(symbol: SymbolInfo, from: number): Promise<void> {
    const token = ++this.token;
    this.reset();
    this.symbol = symbol;
    const a = this.adapter;
    if (!a) return;
    try {
      const [positions, orders, executions] = await Promise.all([
        a.getPositions ? a.getPositions(symbol) : Promise.resolve([]),
        a.getOrders ? a.getOrders(symbol) : Promise.resolve([]),
        a.getExecutions ? a.getExecutions(symbol, { from, to: Date.now() }) : Promise.resolve([]),
      ]);
      if (token !== this.token) return;
      this.loadedFrom = from;
      this.setPositions(positions);
      this.setOrders(orders);
      this.addExecutions(executions);
      this.unsubscribe =
        a.subscribe?.(symbol, {
          onExecution: (e) => token === this.token && this.addExecutions([e]),
          onPositions: (p) => token === this.token && this.setPositions(p),
          onOrders: (o) => token === this.token && this.setOrders(o),
        }) ?? null;
    } catch (error) {
      if (token === this.token) this.onError(error);
    }
  }

  /** Fetches fills for newly loaded older history (bars now start at `from`). */
  async loadOlder(from: number): Promise<void> {
    const a = this.adapter;
    const symbol = this.symbol;
    if (!a?.getExecutions || !symbol || from >= this.loadedFrom) return;
    const token = this.token;
    const to = this.loadedFrom - 1;
    this.loadedFrom = from;
    try {
      const older = await a.getExecutions(symbol, { from, to });
      if (token === this.token) this.addExecutions(older);
    } catch (error) {
      this.onError(error);
    }
  }

  reset(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.positions.forEach((h) => h.remove());
    this.positions = [];
    this.orders.forEach(({ handle }) => handle.remove());
    this.orders.clear();
    this.executions.clear();
    this.loadedFrom = Infinity;
    this.layer.setExecutions([]);
  }

  /** Drops the adapter's lines and stops updates (e.g. adapter removed, chart destroyed). */
  detach(): void {
    this.token++;
    this.reset();
  }

  private setPositions(list: PositionInfo[]): void {
    this.positions.forEach((h) => h.remove());
    this.positions = list.map((p) => this.layer.addPosition({ ...p }));
  }

  private setOrders(list: OrderInfo[]): void {
    const seen = new Set<string>();
    for (const info of list) {
      seen.add(info.id);
      const existing = this.orders.get(info.id);
      if (existing) {
        existing.info = info;
        existing.handle.update({ price: info.price, quantity: info.quantity, side: info.side, ...(info.label ? { label: info.label } : {}) });
      } else {
        const entry = { info, handle: this.layer.addOrder(this.orderOptions(info)) };
        this.orders.set(info.id, entry);
      }
    }
    for (const [id, { handle }] of this.orders) {
      if (seen.has(id)) continue;
      handle.remove();
      this.orders.delete(id);
    }
  }

  private orderOptions(info: OrderInfo): OrderLineOptions {
    const a = this.adapter!;
    const opts: OrderLineOptions = { price: info.price, quantity: info.quantity, side: info.side };
    if (info.label) opts.label = info.label;
    const current = () => this.orders.get(info.id)?.info ?? info;
    if (a.modifyOrder) {
      opts.onMove = async (price) => {
        const ok = await a.modifyOrder!(current(), price);
        const entry = this.orders.get(info.id);
        if (ok !== false && entry) entry.info = { ...entry.info, price };
        return ok;
      };
    }
    if (a.cancelOrder) {
      opts.onCancel = () => {
        Promise.resolve(a.cancelOrder!(current()))
          .then(() => {
            if (a.subscribe) return; // the stream will send the new order list
            this.orders.get(info.id)?.handle.remove();
            this.orders.delete(info.id);
          })
          .catch(this.onError);
      };
    }
    return opts;
  }

  private addExecutions(list: Execution[]): void {
    if (list.length === 0) return;
    for (const e of list) this.executions.set(executionKey(e), e);
    this.layer.setExecutions([...this.executions.values()]);
  }
}
