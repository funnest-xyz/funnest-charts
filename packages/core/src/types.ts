/** A single OHLCV bar. `time` is the bar's open time in UTC milliseconds. */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Bar interval, e.g. '1', '5', '60' (minutes), '1D', '1W', '1M'. */
export type Resolution = string;

/** Minimum price increment. Either fixed, or price-dependent (e.g. KRX). */
export type TickSize = number | ((price: number) => number);

export interface SymbolInfo {
  symbol: string;
  name: string;
  exchange: string;
  /** IANA timezone, e.g. 'Asia/Seoul'. */
  timezone: string;
  /** Trading session, e.g. '0900-1530' or '24x7'. */
  session: string;
  /** Number of decimals to display. */
  pricePrecision: number;
  tickSize: TickSize;
  volumePrecision?: number;
  /** Optional logo shown next to the name in @funnest/charts-ui (falls back to an initial avatar). */
  logoUrl?: string;
  /** Instrument kind; drives search categories and which market stats make sense. */
  type?: SymbolType;
  /** ISO 3166 country of the listing ('KR', 'US'…), e.g. to split 국내/해외 stocks. */
  country?: string;
  /** Resolutions this symbol's feed can serve. Others are shown disabled in the UI. */
  supportedResolutions?: Resolution[];
}

/**
 * A search hit. Market fields are optional: return them when cheap (e.g. from a batch ticker)
 * and the search list shows price, change and a sparkline next to each symbol.
 */
export interface SymbolSearchResult extends SymbolInfo {
  price?: number;
  changePercent?: number;
  /** Recent closes, oldest first (~20–60 points) for the row sparkline. */
  sparkline?: number[];
}

export type SymbolType = 'stock' | 'etf' | 'index' | 'crypto' | 'futures' | 'forex';

/**
 * Live market statistics for the market bar. Every field is optional: show what your
 * venue has (spot has no open interest/funding, stocks have no 24h window…).
 */
export interface Quote {
  price?: number;
  /** Absolute change vs the reference (previous close / 24h ago). */
  change?: number;
  /** Change in percent, e.g. -1.23. */
  changePercent?: number;
  high24h?: number;
  low24h?: number;
  /** Traded quantity over 24h (or today for stocks). */
  volume24h?: number;
  /** Traded value in the quote currency (KRW, USDT…). */
  turnover24h?: number;
  /** Futures: open interest in contracts/base units. */
  openInterest?: number;
  /** Futures: current funding rate as a fraction (0.0001 = 0.01%). */
  fundingRate?: number;
  /** Futures: next funding time, UTC ms. */
  nextFundingTime?: number;
}

export interface ConnectionState {
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  /** Round-trip latency estimate in ms, when the feed can measure it. */
  latency?: number;
}

export interface BarsRequest {
  from: number;
  to: number;
  /** Preferred number of bars ending at `to`; takes priority over `from` when set. */
  countBack?: number;
}

export interface BarsResult {
  bars: Bar[];
  /** True when there is no older history to load. */
  noMoreData: boolean;
}

export type Unsubscribe = () => void;

/**
 * Data source adapter. Implement this once per exchange/broker.
 * Bars passed to `onBar` with the same `time` as the last bar update it;
 * a greater `time` appends a new bar.
 */
export interface Datafeed {
  resolveSymbol(symbol: string): Promise<SymbolInfo>;
  getBars(symbol: SymbolInfo, resolution: Resolution, request: BarsRequest): Promise<BarsResult>;
  /**
   * Realtime updates. Call `onBar` with the current (forming) bar on every tick — the chart
   * batches redraws per frame, so high message rates are fine. After a WebSocket reconnect,
   * call `onResetCache` and the chart re-fetches the recent window via `getBars` to fill the gap.
   */
  subscribeBars(
    symbol: SymbolInfo,
    resolution: Resolution,
    onBar: (bar: Bar) => void,
    onResetCache?: () => void,
    /** Report the realtime connection's state/latency (shown in the status bar). */
    onConnection?: (state: ConnectionState) => void,
  ): Unsubscribe;
  /** Optional: powers the symbol search dialog in @funnest/charts-ui. */
  searchSymbols?(query: string): Promise<SymbolSearchResult[]>;
  /**
   * Optional: search that answers as each source comes in (`onPartial` gets everything so far),
   * so a fast source isn't held up by a slow one. combineDatafeeds provides it.
   */
  searchSymbolsProgressive?(query: string, onPartial: (results: SymbolSearchResult[]) => void): Promise<SymbolSearchResult[]>;
  /**
   * Optional: recent closes for a row's mini line, oldest first. The search dialog asks only for
   * rows on screen, after the results are shown (it never waits for these).
   */
  getSparkline?(symbol: string): Promise<number[]>;
  /** Optional: live market statistics for the market bar. */
  subscribeQuotes?(symbol: SymbolInfo, onQuote: (quote: Quote) => void): Unsubscribe;
}
