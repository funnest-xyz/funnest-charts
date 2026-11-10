/**
 * Starter code an agent (or a person) can drop into an app. These are templates for the
 * app's own code — the library itself never ships exchange connections.
 */
export type DatafeedTemplateKind = 'rest-websocket' | 'polling' | 'static';

const HEADER = `import {
  ReconnectingWebSocket,
  TickAggregator,
  toConnectionStatus,
  type Bar,
  type Datafeed,
  type SymbolInfo,
} from '@funnest/charts';
`;

const SYMBOL = `
async function resolveSymbol(symbol: string): Promise<SymbolInfo> {
  // TODO: 내 API에서 종목 정보를 가져오세요.
  return {
    symbol,
    name: symbol,
    exchange: 'MY-EXCHANGE',
    timezone: 'Asia/Seoul',
    session: '24x7', // KRX 주식이면 '0900-1530'
    pricePrecision: 2,
    tickSize: 0.01,
    // logoUrl: \`https://my.cdn/logos/\${symbol}.png\`,
  };
}
`;

const GET_BARS = `
async function getBars(info: SymbolInfo, resolution: string, req: { to: number; countBack?: number }) {
  // TODO: 과거 봉 API. time은 UTC 밀리초.
  const res = await fetch(\`https://api.example.com/candles?symbol=\${info.symbol}&interval=\${resolution}&end=\${req.to}&limit=\${req.countBack ?? 300}\`);
  const rows: [number, number, number, number, number, number][] = await res.json();
  const bars: Bar[] = rows.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
  return { bars, noMoreData: bars.length === 0 };
}
`;

const TEMPLATES: Record<DatafeedTemplateKind, string> = {
  'rest-websocket': `${HEADER}${SYMBOL}${GET_BARS}
/** REST for history + WebSocket trades aggregated into bars. */
export const datafeed: Datafeed = {
  resolveSymbol,
  getBars,
  subscribeBars(info, resolution, onBar, onResetCache, onConnection) {
    const candles = new TickAggregator(resolution, info.timezone);
    const ws = new ReconnectingWebSocket('wss://stream.example.com/ws', {
      onOpen(socket, reconnected) {
        socket.send(JSON.stringify({ op: 'subscribe', channel: 'trades', symbol: info.symbol }));
        if (reconnected) onResetCache?.(); // refill bars missed while disconnected
      },
      onMessage(data) {
        const msg = JSON.parse(data); // TODO: 거래소 메시지 형식에 맞게
        if (msg.channel !== 'trades') return;
        const bar = candles.push({ time: msg.time, price: Number(msg.price), volume: Number(msg.qty) });
        if (bar) onBar(bar);
      },
      onStatus: (s) => onConnection?.({ status: toConnectionStatus(s) }),
      idleTimeout: 30_000,
    });
    return () => ws.close();
  },
};
`,
  polling: `${HEADER}${SYMBOL}${GET_BARS}
/** No WebSocket? Poll the latest bar every few seconds. */
export const datafeed: Datafeed = {
  resolveSymbol,
  getBars,
  subscribeBars(info, resolution, onBar, _reset, onConnection) {
    let stopped = false;
    const tick = async () => {
      try {
        const { bars } = await getBars(info, resolution, { to: Date.now(), countBack: 1 });
        const last = bars.at(-1);
        if (last && !stopped) onBar(last);
        onConnection?.({ status: 'connected' });
      } catch {
        onConnection?.({ status: 'reconnecting' });
      }
    };
    const id = setInterval(tick, 3_000);
    void tick();
    return () => {
      stopped = true;
      clearInterval(id);
    };
  },
};
`,
  static: `import type { Bar, Datafeed } from '@funnest/charts';

/** Fixed data (backtest results, screenshots, tests). */
export function staticDatafeed(bars: Bar[]): Datafeed {
  return {
    async resolveSymbol(symbol) {
      return { symbol, name: symbol, exchange: 'BACKTEST', timezone: 'Asia/Seoul', session: '24x7', pricePrecision: 2, tickSize: 0.01 };
    },
    async getBars(_info, _res, { to, countBack = 300 }) {
      const end = bars.findLastIndex((b) => b.time <= to) + 1;
      const start = Math.max(0, end - countBack);
      return { bars: bars.slice(start, end), noMoreData: start === 0 };
    },
    subscribeBars: () => () => {},
  };
}
`,
};

export const datafeedTemplate = (kind: DatafeedTemplateKind = 'rest-websocket') => TEMPLATES[kind];
