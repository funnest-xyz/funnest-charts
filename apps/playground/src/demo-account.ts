import { roundToTick, type Bar, type Execution, type OrderInfo, type PositionInfo, type SymbolInfo, type TradingAdapter, type TradingCallbacks } from '@funnest/charts';

/**
 * A fake brokerage account implementing TradingAdapter — the same interface a real site
 * would implement against its backend. Fills are generated deterministically from the
 * chart's bars; one live fill arrives every few seconds.
 */
export function createDemoAccount(bars: () => readonly Bar[], notify: (text: string) => void): TradingAdapter {
  const state = new Map<string, { orders: OrderInfo[]; position: PositionInfo | null; live: Execution[] }>();
  let nextId = 1;

  const account = (symbol: SymbolInfo) => {
    let s = state.get(symbol.symbol);
    if (!s) {
      const last = bars().at(-1);
      const at = (k: number) => roundToTick((last?.close ?? 100) * k, symbol.tickSize);
      s = {
        position: { price: at(0.985), quantity: 10, side: 'long' },
        orders: [
          { id: `o${nextId++}`, price: at(0.97), quantity: 5, side: 'buy', label: '지정가' },
          { id: `o${nextId++}`, price: at(1.03), quantity: 3, side: 'sell', label: '지정가' },
        ],
        live: [],
      };
      state.set(symbol.symbol, s);
    }
    return s;
  };

  /** Deterministic pseudo-fills: roughly one per 25 bars, a few clustered on one bar. */
  const historyFills = (from: number, to: number): Execution[] =>
    bars()
      .filter((b) => b.time >= from && b.time <= to)
      .flatMap((b): Execution[] => {
        const h = Math.abs(Math.sin(b.time / 9_973)) * 1000;
        if (h % 25 > 1) return [];
        const side = h % 2 < 1 ? 'buy' : 'sell';
        const count = h % 7 < 1 ? 3 : 1;
        return Array.from({ length: count }, (_, i) => ({
          id: `h${b.time}-${i}`,
          time: b.time + i * 1000,
          price: side === 'buy' ? b.low : b.high,
          side,
          quantity: 1 + Math.floor(h % 5),
        }));
      });

  return {
    async getExecutions(symbol, { from, to }) {
      return [...historyFills(from, to), ...account(symbol).live.filter((e) => e.time >= from && e.time <= to)];
    },
    async getPositions(symbol) {
      const p = account(symbol).position;
      return p ? [p] : [];
    },
    async getOrders(symbol) {
      return account(symbol).orders;
    },
    subscribe(symbol, cb: TradingCallbacks) {
      const timer = setInterval(() => {
        const last = bars().at(-1);
        if (!last) return;
        const fill: Execution = { id: `live${Date.now()}`, time: last.time, price: last.close, side: 'buy', quantity: 1 };
        const s = account(symbol);
        s.live.push(fill);
        if (s.position) {
          const qty = s.position.quantity + 1;
          s.position = { ...s.position, quantity: qty, price: roundToTick((s.position.price * (qty - 1) + fill.price) / qty, symbol.tickSize) };
          cb.onPositions([s.position]);
        }
        cb.onExecution(fill);
      }, 6000);
      return () => clearInterval(timer);
    },
    modifyOrder(order, price) {
      if (order.side === 'sell') {
        notify('매도 정정 거절 → 원래 가격으로 복귀');
        return false;
      }
      // Simulated broker round-trip; the chart already moved the line optimistically.
      return new Promise<boolean>((ok) =>
        setTimeout(() => {
          for (const s of state.values()) s.orders = s.orders.map((o) => (o.id === order.id ? { ...o, price } : o));
          notify(`매수 주문 정정: ${price}`);
          ok(true);
        }, 300),
      );
    },
    async cancelOrder(order) {
      for (const s of state.values()) s.orders = s.orders.filter((o) => o.id !== order.id);
      notify('매수 주문 취소');
    },
  };
}
