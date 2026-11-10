// Example exchange adapter (site/demo code — NOT part of the published library).
import {
  decimalsOf,
  ReconnectingWebSocket,
  toConnectionStatus,
  type SocketStatus,
  resolutionToMs,
  type Bar,
  type BarsRequest,
  type BarsResult,
  type ConnectionState,
  type Datafeed,
  type Quote,
  type Resolution,
  type SymbolInfo,
} from '@funnest/charts';
import { getJson } from './http';

const INTERVALS: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '360': '6h',
  '720': '12h',
  '1D': '1d',
  D: '1d',
  '1W': '1w',
  W: '1w',
  '1M': '1M',
  M: '1M',
};
const SUPPORTED = ['1', '3', '5', '15', '30', '60', '120', '240', '360', '720', '1D', '1W', '1M'];
const MAX_PER_REQUEST = { spot: 1000, usdm: 1500 };
const OPEN_INTEREST_POLL_MS = 15_000;
const PING_INTERVAL_MS = 10_000;

type Kline = [number, string, string, string, string, string, ...unknown[]];

interface ExchangeSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType?: string;
  filters: { filterType: string; tickSize?: string }[];
}

export interface BinanceDatafeedOptions {
  /** 'spot' (default) or 'usdm' — USDⓈ-M perpetual futures, which adds open interest and funding. */
  market?: 'spot' | 'usdm';
  /** Symbols offered in search (spot's full list is ~2MB, so search is limited to these). */
  symbols?: string[];
  /** Axis/label timezone. Default: the browser's. */
  timezone?: string;
  onStatus?: (status: SocketStatus) => void;
}

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT'];
const ENDPOINTS = {
  spot: { rest: 'https://api.binance.com/api/v3', ws: 'wss://stream.binance.com:9443/ws' },
  // Futures market-data streams live under /market (the bare /ws path accepts connections but stays silent).
  usdm: { rest: 'https://fapi.binance.com/fapi/v1', ws: 'wss://fstream.binance.com/market/ws' },
};

/**
 * Binance datafeed: REST klines for history, the `@kline_<interval>` stream (complete bars)
 * for realtime, `@ticker` for the market bar. With `market: 'usdm'` it serves perpetual
 * futures and adds open interest (polled) and funding (`@markPrice`).
 */
export class BinanceDatafeed implements Datafeed {
  private readonly infos = new Map<string, Promise<SymbolInfo>>();
  private futuresInfo: Promise<ExchangeSymbol[]> | null = null;
  private readonly market: 'spot' | 'usdm';
  private readonly rest: string;
  private readonly ws: string;

  constructor(private readonly options: BinanceDatafeedOptions = {}) {
    this.market = options.market ?? 'spot';
    this.rest = ENDPOINTS[this.market].rest;
    this.ws = ENDPOINTS[this.market].ws;
  }

  private toInfo(s: ExchangeSymbol): SymbolInfo {
    const tick = Number(s.filters.find((f) => f.filterType === 'PRICE_FILTER')?.tickSize ?? '0.01');
    const futures = this.market === 'usdm';
    return {
      symbol: s.symbol,
      name: futures ? `${s.baseAsset}/${s.quoteAsset} 무기한` : `${s.baseAsset}/${s.quoteAsset}`,
      // Demo-only: Upbit's public coin logos (the library never ships images).
      logoUrl: `https://static.upbit.com/logos/${s.baseAsset}.png`,
      exchange: futures ? 'Binance Futures' : 'Binance',
      timezone: this.options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      session: '24x7',
      pricePrecision: decimalsOf(tick),
      tickSize: tick,
      type: futures ? 'futures' : 'crypto',
      supportedResolutions: SUPPORTED,
    };
  }

  /** Futures exchangeInfo has no per-symbol filter, so it's fetched once and cached. */
  private loadFutures(): Promise<ExchangeSymbol[]> {
    this.futuresInfo ??= getJson<{ symbols: ExchangeSymbol[] }>(`${this.rest}/exchangeInfo`).then((r) =>
      r.symbols.filter((s) => s.contractType === 'PERPETUAL'),
    );
    this.futuresInfo.catch(() => (this.futuresInfo = null));
    return this.futuresInfo;
  }

  resolveSymbol(symbol: string): Promise<SymbolInfo> {
    const key = symbol.toUpperCase();
    let info = this.infos.get(key);
    if (!info) {
      info =
        this.market === 'usdm'
          ? this.loadFutures().then((list) => {
              const s = list.find((x) => x.symbol === key);
              if (!s) throw new Error(`Binance Futures: unknown symbol ${key}`);
              return this.toInfo(s);
            })
          : getJson<{ symbols: ExchangeSymbol[] }>(`${this.rest}/exchangeInfo?symbol=${key}`).then(({ symbols }) => {
              if (!symbols[0]) throw new Error(`Binance: unknown symbol ${key}`);
              return this.toInfo(symbols[0]);
            });
      info.catch(() => this.infos.delete(key));
      this.infos.set(key, info);
    }
    return info;
  }

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    const q = query.trim().toUpperCase().replace('/', '');
    const list = (this.options.symbols ?? DEFAULT_SYMBOLS).filter((s) => !q || s.includes(q));
    const settled = await Promise.allSettled(list.map((s) => this.resolveSymbol(s)));
    return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  }

  private interval(resolution: Resolution): string {
    // Bare numbers are minutes, so only D/W need case-folding ('1M' stays "month").
    const interval = INTERVALS[resolution] ?? INTERVALS[resolution.replace(/[dw]$/, (c) => c.toUpperCase())];
    if (!interval) throw new Error(`Binance: unsupported resolution ${resolution}`);
    return interval;
  }

  async getBars(info: SymbolInfo, resolution: Resolution, req: BarsRequest): Promise<BarsResult> {
    const interval = this.interval(resolution);
    const wanted = req.countBack ?? Math.ceil((req.to - req.from) / resolutionToMs(resolution));
    const bars: Bar[] = [];
    let endTime = req.to;
    let exhausted = false;

    while (bars.length < wanted) {
      const limit = Math.min(MAX_PER_REQUEST[this.market], wanted - bars.length);
      const rows = await getJson<Kline[]>(`${this.rest}/klines?symbol=${info.symbol}&interval=${interval}&endTime=${endTime}&limit=${limit}`);
      const chunk = rows.map(([time, o, h, l, c, v]) => ({
        time,
        open: Number(o),
        high: Number(h),
        low: Number(l),
        close: Number(c),
        volume: Number(v),
      }));
      bars.unshift(...chunk);
      if (rows.length < limit || !chunk[0]) {
        exhausted = true;
        break;
      }
      endTime = chunk[0].time - 1;
    }
    return { bars, noMoreData: exhausted };
  }

  /** WS JSON-RPC that returns immediately — a cheap ping for round-trip latency. */
  private pingOptions() {
    let id = 0;
    return {
      interval: PING_INTERVAL_MS,
      message: () => JSON.stringify({ method: 'LIST_SUBSCRIPTIONS', id: (id = 1_000_000 + ((id + 1) % 1000)) }),
      isPong: (text: string) => text.startsWith('{"result"') && text.includes(`"id":${id}`),
    };
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
    };
    const socket = new ReconnectingWebSocket(`${this.ws}/${info.symbol.toLowerCase()}@kline_${this.interval(resolution)}`, {
      // Kline updates arrive every ~1-2s, so silence means a dead connection.
      idleTimeout: 30_000,
      ping: this.pingOptions(),
      onLatency: (latency) => report({ latency }),
      onOpen: (_ws, reconnected) => reconnected && onResetCache?.(),
      onStatus: (status) => {
        report({ status: toConnectionStatus(status) });
        this.options.onStatus?.(status);
      },
      onMessage: (text) => {
        const k = (JSON.parse(text) as { k?: { t: number; o: string; h: string; l: string; c: string; v: string } }).k;
        if (!k) return;
        onBar({ time: k.t, open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: Number(k.v) });
      },
    });
    return () => socket.close();
  }

  /** 24h ticker; futures add funding (`@markPrice`) and open interest (REST, every 15s). */
  subscribeQuotes(info: SymbolInfo, onQuote: (quote: Quote) => void) {
    const symbol = info.symbol.toLowerCase();
    const streams = this.market === 'usdm' ? `${symbol}@ticker/${symbol}@markPrice@1s` : `${symbol}@ticker`;
    const socket = new ReconnectingWebSocket(`${this.ws.replace(/\/ws$/, '')}/stream?streams=${streams}`, {
      onMessage: (text) => {
        const { data: d } = JSON.parse(text) as { data: Record<string, string | number> };
        if (d.e === '24hrTicker') {
          onQuote({
            price: Number(d.c),
            change: Number(d.p),
            changePercent: Number(d.P),
            high24h: Number(d.h),
            low24h: Number(d.l),
            volume24h: Number(d.v),
            turnover24h: Number(d.q),
          });
        } else if (d.e === 'markPriceUpdate') {
          onQuote({ fundingRate: Number(d.r), nextFundingTime: Number(d.T) });
        }
      },
    });
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pollOpenInterest = async () => {
      try {
        const r = await getJson<{ openInterest: string }>(`${this.rest}/openInterest?symbol=${info.symbol}`);
        if (!stopped) onQuote({ openInterest: Number(r.openInterest) });
      } catch {
        /* keep the last value */
      }
      if (!stopped) timer = setTimeout(pollOpenInterest, OPEN_INTEREST_POLL_MS);
    };
    if (this.market === 'usdm') void pollOpenInterest();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.close();
    };
  }
}
