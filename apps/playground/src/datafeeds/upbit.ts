// Example exchange adapter (site/demo code — NOT part of the published library).
import {
  decimalsOf,
  monitorLatency,
  ReconnectingWebSocket,
  toConnectionStatus,
  type SocketStatus,
  type ConnectionState,
  type Quote,
  resolutionToMs,
  TickAggregator,
  type Bar,
  type BarsRequest,
  type BarsResult,
  type Datafeed,
  type Resolution,
  type SymbolInfo,
  type SymbolSearchResult,
} from '@funnest/charts';
import { getJson } from './http';

const REST = 'https://api.upbit.com/v1';
const WS = 'wss://api.upbit.com/websocket/v1';
const MINUTE_UNITS = [1, 3, 5, 10, 15, 30, 60, 240];
const SUPPORTED = [...MINUTE_UNITS.map(String), '1D', '1W', '1M'];
const MAX_PER_REQUEST = 200;

interface UpbitMarket {
  market: string;
  korean_name: string;
  english_name: string;
}

interface UpbitCandle {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

interface UpbitTrade {
  type?: string;
  ty?: string;
  code?: string;
  trade_timestamp?: number;
  trade_price?: number;
  trade_volume?: number;
}

/** KRW market tick sizes (approximate table — check Upbit's notice for the latest rules). */
export function upbitKrwTickSize(price: number): number {
  if (price >= 2_000_000) return 1000;
  if (price >= 1_000_000) return 500;
  if (price >= 500_000) return 100;
  if (price >= 100_000) return 50;
  if (price >= 10_000) return 10;
  if (price >= 1_000) return 1;
  if (price >= 100) return 0.1;
  if (price >= 10) return 0.01;
  if (price >= 1) return 0.001;
  if (price >= 0.1) return 0.0001;
  return 0.00001;
}

export interface UpbitDatafeedOptions {
  /** Quote currencies offered in search. Default ['KRW']. */
  quotes?: string[];
  /** Axis/label timezone. Default 'Asia/Seoul'. */
  timezone?: string;
  /** 'ko' shows Korean names (비트코인), 'en' English. Default 'ko'. */
  language?: 'ko' | 'en';
  onStatus?: (status: SocketStatus) => void;
}

/**
 * Upbit datafeed: REST candles for history, the `trade` WebSocket stream aggregated
 * into bars for realtime. Symbols are market codes, e.g. 'KRW-BTC'.
 */
export class UpbitDatafeed implements Datafeed {
  private markets: Promise<UpbitMarket[]> | null = null;
  /** Latest bar per symbol/resolution, used to seed the tick aggregator. */
  private readonly latest = new Map<string, Bar>();

  constructor(private readonly options: UpbitDatafeedOptions = {}) {}

  private loadMarkets(): Promise<UpbitMarket[]> {
    this.markets ??= getJson<UpbitMarket[]>(`${REST}/market/all?isDetails=false`).catch((e: unknown) => {
      this.markets = null;
      throw e;
    });
    return this.markets;
  }

  private toInfo(m: UpbitMarket, price?: number): SymbolInfo {
    const [quote = 'KRW', coin = ''] = m.market.split('-');
    const tickSize = quote === 'KRW' ? upbitKrwTickSize : quote === 'BTC' ? 0.00000001 : 0.001;
    const sampleTick = typeof tickSize === 'function' ? tickSize(price ?? 1) : tickSize;
    const name = (this.options.language ?? 'ko') === 'ko' ? m.korean_name : m.english_name;
    return {
      symbol: m.market,
      name: quote === 'KRW' ? name : `${name} (${quote})`,
      exchange: 'Upbit',
      timezone: this.options.timezone ?? 'Asia/Seoul',
      session: '24x7',
      pricePrecision: decimalsOf(sampleTick),
      tickSize,
      logoUrl: `https://static.upbit.com/logos/${coin}.png`,
      type: 'crypto',
      country: 'KR',
      supportedResolutions: SUPPORTED,
    };
  }

  /** Matches plus price/change from one batch ticker request (no per-symbol sparkline). */
  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const quotes = this.options.quotes ?? ['KRW'];
    const q = query.trim().toLowerCase();
    const hits = (await this.loadMarkets())
      .filter((m) => quotes.includes(m.market.split('-')[0]!))
      .filter(
        (m) =>
          !q ||
          m.market.toLowerCase().includes(q) ||
          m.korean_name.toLowerCase().includes(q) ||
          m.english_name.toLowerCase().includes(q),
      )
      .slice(0, 50);
    const tickers = new Map<string, { trade_price: number; signed_change_rate: number }>();
    try {
      const rows = await getJson<{ market: string; trade_price: number; signed_change_rate: number }[]>(
        `${REST}/ticker?markets=${hits.map((m) => m.market).join(',')}`,
      );
      for (const r of rows) tickers.set(r.market, r);
    } catch {
      /* search still works without prices */
    }
    return hits.map((m) => {
      const t = tickers.get(m.market);
      const info = this.toInfo(m, t?.trade_price);
      return t ? { ...info, price: t.trade_price, changePercent: t.signed_change_rate * 100 } : info;
    });
  }

  async resolveSymbol(symbol: string): Promise<SymbolInfo> {
    const market = (await this.loadMarkets()).find((m) => m.market === symbol);
    if (!market) throw new Error(`Upbit: unknown market ${symbol}`);
    const [ticker] = await getJson<{ trade_price: number }[]>(`${REST}/ticker?markets=${symbol}`);
    return this.toInfo(market, ticker?.trade_price);
  }

  private endpoint(resolution: Resolution): string {
    const r = resolution.toUpperCase();
    if (r === 'D' || r === '1D') return 'candles/days';
    if (r === 'W' || r === '1W') return 'candles/weeks';
    if (r === 'M' || r === '1M') return 'candles/months';
    const minutes = Number(resolution);
    if (MINUTE_UNITS.includes(minutes)) return `candles/minutes/${minutes}`;
    throw new Error(`Upbit: unsupported resolution ${resolution} (minutes: ${MINUTE_UNITS.join(', ')}, 1D, 1W, 1M)`);
  }

  async getBars(info: SymbolInfo, resolution: Resolution, req: BarsRequest): Promise<BarsResult> {
    const path = this.endpoint(resolution);
    const wanted = req.countBack ?? Math.ceil((req.to - req.from) / resolutionToMs(resolution));
    // `to` is exclusive and second-precision: +1s keeps the bar starting at req.to.
    let to = Math.floor(req.to / 1000) * 1000 + 1000;
    const bars: Bar[] = [];
    let exhausted = false;

    while (bars.length < wanted) {
      const count = Math.min(MAX_PER_REQUEST, wanted - bars.length);
      const iso = new Date(to).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const rows = await getJson<UpbitCandle[]>(`${REST}/${path}?market=${info.symbol}&count=${count}&to=${iso}`);
      for (const c of rows) {
        bars.push({
          time: Date.parse(`${c.candle_date_time_utc}Z`),
          open: c.opening_price,
          high: c.high_price,
          low: c.low_price,
          close: c.trade_price,
          volume: c.candle_acc_trade_volume,
        });
      }
      if (rows.length < count) {
        exhausted = true;
        break;
      }
      to = bars[bars.length - 1]!.time;
    }
    bars.reverse();

    const last = bars[bars.length - 1];
    if (last && req.to >= Date.now() - resolutionToMs(resolution)) this.latest.set(`${info.symbol}|${resolution}`, last);
    return { bars, noMoreData: exhausted };
  }

  subscribeBars(
    info: SymbolInfo,
    resolution: Resolution,
    onBar: (bar: Bar) => void,
    onResetCache?: () => void,
    onConnection?: (state: ConnectionState) => void,
  ) {
    const state: ConnectionState = { status: 'connecting' };
    const report = (patch: Partial<ConnectionState>) => {
      Object.assign(state, patch);
      onConnection?.({ ...state });
      if (patch.status) this.options.onStatus?.(patch.status === 'connected' ? 'open' : patch.status === 'disconnected' ? 'closed' : patch.status);
    };
    // Upbit's WS PING answers lazily (seconds), so latency is timed on a tiny REST call instead.
    const stopLatency = onConnection
      ? monitorLatency(() => getJson(`${REST}/ticker?markets=${info.symbol}`), (latency) => report({ latency }))
      : () => {};
    // Upbit day/week candles open at 00:00 UTC (09:00 KST), so buckets are computed in UTC.
    const aggregator = new TickAggregator(resolution, 'UTC');
    aggregator.seed(this.latest.get(`${info.symbol}|${resolution}`));

    const socket = new ReconnectingWebSocket(WS, {
      onOpen: (ws, reconnected) => {
        ws.send(JSON.stringify([{ ticket: `fnc-${Math.random().toString(36).slice(2)}` }, { type: 'trade', codes: [info.symbol] }]));
        if (!reconnected) return;
        // Trades during the outage are lost: re-seed from REST, then let the chart refetch history.
        void this.getBars(info, resolution, { from: 0, to: Date.now(), countBack: 1 })
          .then(({ bars }) => aggregator.seed(bars[bars.length - 1]))
          .finally(() => onResetCache?.());
      },
      onMessage: (text) => {
        const m = JSON.parse(text) as UpbitTrade;
        if ((m.type ?? m.ty) !== 'trade' || m.trade_timestamp === undefined || m.trade_price === undefined) return;
        const bar = aggregator.push({ time: m.trade_timestamp, price: m.trade_price, volume: m.trade_volume ?? 0 });
        if (bar) onBar(bar);
      },
      onStatus: (status: SocketStatus) => report({ status: toConnectionStatus(status) }),
    });
    return () => {
      stopLatency();
      socket.close();
    };
  }

  /** Market bar data from Upbit's `ticker` stream (change is vs the 09:00 KST daily open). */
  subscribeQuotes(info: SymbolInfo, onQuote: (quote: Quote) => void) {
    const socket = new ReconnectingWebSocket(WS, {
      onOpen: (ws) => ws.send(JSON.stringify([{ ticket: `fnc-q-${Math.random().toString(36).slice(2)}` }, { type: 'ticker', codes: [info.symbol] }])),
      onMessage: (text) => {
        const t = JSON.parse(text) as Record<string, number | string>;
        if ((t.type ?? t.ty) !== 'ticker') return;
        onQuote({
          price: Number(t.trade_price),
          change: Number(t.signed_change_price),
          changePercent: Number(t.signed_change_rate) * 100,
          high24h: Number(t.high_price),
          low24h: Number(t.low_price),
          volume24h: Number(t.acc_trade_volume_24h),
          turnover24h: Number(t.acc_trade_price_24h),
        });
      },
    });
    return () => socket.close();
  }
}
