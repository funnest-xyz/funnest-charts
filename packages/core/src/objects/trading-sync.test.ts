import { describe, expect, it, vi } from 'vitest';
import type { SymbolInfo } from '../types';
import { TradingLayer } from './trading';
import { TradingSync, type OrderInfo, type TradingAdapter, type TradingCallbacks } from './trading-sync';

const symbol: SymbolInfo = {
  symbol: 'TEST',
  name: 'Test',
  exchange: 'X',
  timezone: 'UTC',
  session: '24x7',
  pricePrecision: 0,
  tickSize: 1,
};
const flush = () => new Promise((r) => setTimeout(r, 0));
const ordersOf = (layer: TradingLayer) => [...layer['orders'].values()];
const positionsOf = (layer: TradingLayer) => [...layer['positions'].values()];

describe('TradingSync', () => {
  it('loads positions, orders and fills for a symbol, de-duplicating fills', async () => {
    const layer = new TradingLayer(() => {});
    const sync = new TradingSync(layer, () => {});
    let live: TradingCallbacks | undefined;
    const getExecutions = vi.fn(async (_s: SymbolInfo, { from }: { from: number; to: number }) =>
      from === 1000
        ? [{ id: 'a', time: 1500, price: 10, side: 'buy' as const, quantity: 2 }]
        : [{ id: 'old', time: 500, price: 9, side: 'sell' as const }],
    );
    sync.adapter = {
      getExecutions,
      getPositions: async () => [{ price: 10, quantity: 2, side: 'long' }],
      getOrders: async () => [{ id: 'o1', price: 12, quantity: 1, side: 'sell' }],
      subscribe: (_s, cb) => ((live = cb), () => {}),
    };

    await sync.load(symbol, 1000);
    expect(positionsOf(layer)).toHaveLength(1);
    expect(ordersOf(layer).map((o) => o.price)).toEqual([12]);
    expect(layer.executionList).toHaveLength(1);

    live!.onExecution({ id: 'a', time: 1500, price: 10, side: 'buy', quantity: 2 }); // duplicate
    live!.onExecution({ id: 'b', time: 1600, price: 11, side: 'buy' });
    expect(layer.executionList).toHaveLength(2);

    live!.onOrders([{ id: 'o1', price: 13, quantity: 1, side: 'sell' }, { id: 'o2', price: 8, quantity: 3, side: 'buy' }]);
    expect(ordersOf(layer).map((o) => o.price).sort()).toEqual([13, 8].sort());
    live!.onOrders([{ id: 'o2', price: 8, quantity: 3, side: 'buy' }]);
    expect(ordersOf(layer)).toHaveLength(1);

    await sync.loadOlder(200);
    expect(getExecutions).toHaveBeenLastCalledWith(symbol, { from: 200, to: 999 });
    expect(layer.executionList).toHaveLength(3);
  });

  it('wires modify/cancel and removes a cancelled line when there is no stream', async () => {
    const layer = new TradingLayer(() => {});
    const sync = new TradingSync(layer, () => {});
    const modifyOrder = vi.fn(async (_o: OrderInfo, _p: number) => true);
    const cancelOrder = vi.fn(async () => {});
    const adapter: TradingAdapter = {
      getOrders: async () => [{ id: 'o1', price: 100, quantity: 1, side: 'buy' }],
      modifyOrder,
      cancelOrder,
    };
    sync.adapter = adapter;
    await sync.load(symbol, 0);

    const order = ordersOf(layer)[0]!;
    await order.onMove!(105);
    expect(modifyOrder).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1', price: 100 }), 105);
    await order.onMove!(110); // next modify sees the updated price
    expect(modifyOrder).toHaveBeenLastCalledWith(expect.objectContaining({ price: 105 }), 110);

    order.onCancel!();
    await flush();
    expect(cancelOrder).toHaveBeenCalled();
    expect(ordersOf(layer)).toHaveLength(0);
  });

  it('ignores a stale load when the symbol changes mid-flight', async () => {
    const layer = new TradingLayer(() => {});
    const sync = new TradingSync(layer, () => {});
    let resolveSlow!: (v: { price: number; quantity: number; side: 'long' }[]) => void;
    sync.adapter = { getPositions: () => new Promise((r) => (resolveSlow = r)) };
    const first = sync.load(symbol, 0);
    sync.adapter = { getPositions: async () => [] };
    await sync.load({ ...symbol, symbol: 'OTHER' }, 0);
    resolveSlow([{ price: 1, quantity: 1, side: 'long' }]);
    await first;
    expect(positionsOf(layer)).toHaveLength(0);
  });
});
